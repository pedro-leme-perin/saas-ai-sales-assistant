// =============================================
// 📊 UsageQuotasService (Session 55 — Feature A2)
// =============================================
// Per-tenant metered quotas with monthly windows + threshold alerts.
//
// Design:
// - Period is month-anchored UTC (1st 00:00Z inclusive → next 1st exclusive).
//   Rows keyed by (companyId, metric, periodStart). Unique constraint
//   `usage_quota_period_unique` prevents double-provisioning.
// - Plan-based default limits; `limit = -1` means UNLIMITED (Enterprise).
//   Admins can override via `upsertLimit` to negotiate custom caps.
// - `recordUsage(companyId, metric, delta=1)`:
//     1. provisions current-period row if missing
//     2. atomic `update({increment: delta})`
//     3. compares `warnedThresholds[]` (persisted int[] ⊆ {80,95,100})
//        against `percentage = currentValue * 100 / limit`
//     4. emits `usage.threshold.crossed` via EventEmitter for each newly
//        crossed step (listeners fire-and-forget: email, webhook, notif).
// - Unlimited metrics short-circuit: no percentage math, no alerts.
// - `checkQuota(companyId, metric)` is read-only; returns
//   {used, limit, pct, isOverLimit, isNearLimit, isUnlimited}.
// - Fail-open semantics: errors during metering must never block the
//   originating action (call, message, suggestion) — wrapped in try/catch
//   at callsite.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, Plan, Prisma, UsageMetric, UsageQuota } from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';

export const USAGE_THRESHOLD_EVENT = 'usage.threshold.crossed';
const THRESHOLDS = [80, 95, 100] as const;

export type QuotaCheck = {
  metric: UsageMetric;
  used: number;
  limit: number;
  pct: number;
  isUnlimited: boolean;
  isNearLimit: boolean;
  isOverLimit: boolean;
  periodStart: Date;
  periodEnd: Date;
};

export type ThresholdCrossedPayload = {
  companyId: string;
  metric: UsageMetric;
  threshold: number;
  used: number;
  limit: number;
  periodStart: Date;
  periodEnd: Date;
};

/**
 * Plan → metric → monthly limit. -1 means unlimited.
 * Tuned to match enforcement rhythm of the billing plans.
 */
const PLAN_DEFAULTS: Record<Plan, Record<UsageMetric, number>> = {
  STARTER: {
    CALLS: 500,
    WHATSAPP_MESSAGES: 1_000,
    AI_SUGGESTIONS: 2_000,
    STORAGE_MB: 500,
  },
  PROFESSIONAL: {
    CALLS: 2_000,
    WHATSAPP_MESSAGES: 5_000,
    AI_SUGGESTIONS: 10_000,
    STORAGE_MB: 5_000,
  },
  ENTERPRISE: {
    CALLS: -1,
    WHATSAPP_MESSAGES: -1,
    AI_SUGGESTIONS: -1,
    STORAGE_MB: 50_000,
  },
};

@Injectable()
export class UsageQuotasService {
  private readonly logger = new Logger(UsageQuotasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ===== Period math ====================================================

  /** Month-anchored UTC period [start, end). */
  periodRange(now = new Date()): { start: Date; end: Date } {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    return { start, end };
  }

  // ===== Read ============================================================

  async list(companyId: string): Promise<UsageQuota[]> {
    const { start } = this.periodRange();
    return this.prisma.usageQuota.findMany({
      where: { companyId, periodStart: start },
      orderBy: { metric: 'asc' },
    });
  }

  async checkQuota(companyId: string, metric: UsageMetric): Promise<QuotaCheck> {
    const row = await this.getOrProvision(companyId, metric);
    return this.toCheck(row);
  }

  // ===== Metering =======================================================

  /**
   * Atomically increment current value, provision if missing, and emit
   * threshold events for newly crossed steps. Non-throwing wrapper
   * expected at callsites so metering never blocks the hot path.
   */
  async recordUsage(
    companyId: string,
    metric: UsageMetric,
    delta = 1,
  ): Promise<QuotaCheck> {
    const row = await this.getOrProvision(companyId, metric);
    if (row.limit === -1) {
      // Unlimited — still bump currentValue for observability, skip alert math.
      const updated = await this.prisma.usageQuota.update({
        where: { id: row.id },
        data: { currentValue: { increment: delta }, lastUpdatedAt: new Date() },
      });
      return this.toCheck(updated);
    }

    const updated = await this.prisma.usageQuota.update({
      where: { id: row.id },
      data: { currentValue: { increment: delta }, lastUpdatedAt: new Date() },
    });

    const pct = this.pctOf(updated.currentValue, updated.limit);
    const alreadyWarned = new Set<number>(updated.warnedThresholds);
    const newlyCrossed = THRESHOLDS.filter((t) => pct >= t && !alreadyWarned.has(t));

    if (newlyCrossed.length > 0) {
      await this.prisma.usageQuota.update({
        where: { id: updated.id },
        data: { warnedThresholds: [...updated.warnedThresholds, ...newlyCrossed] },
      });

      for (const threshold of newlyCrossed) {
        const payload: ThresholdCrossedPayload = {
          companyId,
          metric,
          threshold,
          used: updated.currentValue,
          limit: updated.limit,
          periodStart: updated.periodStart,
          periodEnd: updated.periodEnd,
        };
        try {
          this.eventEmitter.emit(USAGE_THRESHOLD_EVENT, payload);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`threshold event emit failed: ${msg}`);
        }
      }
    }

    return this.toCheck(updated);
  }

  // ===== Admin overrides ================================================

  async upsertLimit(
    companyId: string,
    actorId: string,
    metric: UsageMetric,
    limit: number,
  ): Promise<UsageQuota> {
    const { start, end } = this.periodRange();
    const existing = await this.prisma.usageQuota.findUnique({
      where: { usage_quota_period_unique: { companyId, metric, periodStart: start } },
    });

    const updated = await this.prisma.usageQuota.upsert({
      where: { usage_quota_period_unique: { companyId, metric, periodStart: start } },
      create: {
        companyId,
        metric,
        periodStart: start,
        periodEnd: end,
        limit,
        currentValue: 0,
      },
      update: {
        limit,
        // When admin bumps the cap, re-evaluate warnings: drop any threshold
        // that no longer applies at the new (larger) limit.
        warnedThresholds: existing ? this.reconcileThresholds(existing.currentValue, limit, existing.warnedThresholds) : [],
      },
    });

    void this.audit(companyId, actorId, AuditAction.UPDATE, updated.id, {
      oldValues: existing ? { limit: existing.limit } : null,
      newValues: { limit },
    });

    return updated;
  }

  // ===== Provisioning ===================================================

  async getOrProvision(companyId: string, metric: UsageMetric): Promise<UsageQuota> {
    const { start, end } = this.periodRange();
    const existing = await this.prisma.usageQuota.findUnique({
      where: { usage_quota_period_unique: { companyId, metric, periodStart: start } },
    });
    if (existing) return existing;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const defaultLimit = PLAN_DEFAULTS[company.plan][metric];
    try {
      return await this.prisma.usageQuota.create({
        data: {
          companyId,
          metric,
          periodStart: start,
          periodEnd: end,
          limit: defaultLimit,
          currentValue: 0,
        },
      });
    } catch (err) {
      // Concurrent provisioning — re-read the winner.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.usageQuota.findUnique({
          where: { usage_quota_period_unique: { companyId, metric, periodStart: start } },
        });
        if (winner) return winner;
      }
      throw err;
    }
  }

  // ===== Monthly rollover =============================================
  // Defensive sanity pass: at 01:00 UTC on the 1st, pre-provision rows
  // for tenants that were active last month. Not strictly required
  // because `getOrProvision` auto-creates on first read, but avoids
  // first-request latency spikes at the start of a billing period.
  @Cron(CronExpression.EVERY_HOUR, { name: 'usage-quotas-rollover' })
  async rolloverSanityPass(): Promise<void> {
    const now = new Date();
    if (now.getUTCDate() !== 1 || now.getUTCHours() !== 1) return;

    try {
      const { start, end } = this.periodRange(now);
      const companies = await this.prisma.company.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, plan: true },
        take: 1_000,
      });

      for (const company of companies) {
        for (const metric of Object.values(UsageMetric) as UsageMetric[]) {
          const defaultLimit = PLAN_DEFAULTS[company.plan][metric];
          try {
            await this.prisma.usageQuota.upsert({
              where: {
                usage_quota_period_unique: { companyId: company.id, metric, periodStart: start },
              },
              create: {
                companyId: company.id,
                metric,
                periodStart: start,
                periodEnd: end,
                limit: defaultLimit,
                currentValue: 0,
              },
              update: {},
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`rollover skipped ${company.id}/${metric}: ${msg}`);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`rollover sanity pass failed: ${msg}`);
    }
  }

  // ===== Helpers ========================================================

  private pctOf(used: number, limit: number): number {
    if (limit <= 0) return 0;
    return Math.floor((used * 100) / limit);
  }

  private reconcileThresholds(used: number, newLimit: number, warned: number[]): number[] {
    if (newLimit === -1 || newLimit <= 0) return [];
    const pct = this.pctOf(used, newLimit);
    return warned.filter((t) => pct >= t);
  }

  private toCheck(row: UsageQuota): QuotaCheck {
    const isUnlimited = row.limit === -1;
    const pct = isUnlimited ? 0 : this.pctOf(row.currentValue, row.limit);
    return {
      metric: row.metric,
      used: row.currentValue,
      limit: row.limit,
      pct,
      isUnlimited,
      isNearLimit: !isUnlimited && pct >= 80 && pct < 100,
      isOverLimit: !isUnlimited && pct >= 100,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
    };
  }

  private async audit(
    companyId: string,
    userId: string,
    action: AuditAction,
    resourceId: string,
    values: { oldValues?: unknown; newValues?: unknown },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'USAGE_QUOTA',
          resourceId,
          oldValues: (values.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
          newValues: (values.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`usage quota audit failed: ${msg}`);
    }
  }
}
