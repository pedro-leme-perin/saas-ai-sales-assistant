// =============================================
// 🎯 GOALS SERVICE (Session 45)
// =============================================
// CRUD for TeamGoal + leaderboard aggregation.
//
// Period math:
//   - WEEKLY  → ISO week starting Monday 00:00Z, exclusive end next Monday.
//   - MONTHLY → First day of month 00:00Z, exclusive end first day next month.
// A period is uniquely identified by (companyId, userId|null, metric, periodStart).
//
// Leaderboard:
//   - Ranks active (non-deleted) users in the tenant by composite progress
//     against the active period's goals, or raw metrics if no goal is set.
//   - Metrics computed via findMany + in-memory aggregation (same pattern
//     as coaching.service — avoids Prisma groupBy generics fragility).
// =============================================

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  GoalMetric,
  GoalPeriodType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  metrics: {
    callsTotal: number;
    callsCompleted: number;
    conversionRate: number; // 0-100
    aiSuggestionsShown: number;
    aiSuggestionsUsed: number;
    aiAdoptionRate: number; // 0-100
    whatsappMessagesSent: number;
  };
  goals: Array<{
    id: string;
    metric: GoalMetric;
    target: number;
    current: number;
    progressPct: number; // 0-100 (capped)
    isCompanyWide: boolean;
  }>;
  compositeScore: number; // 0-100 — weighted average of progressPct across goals
}

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // PERIOD HELPERS (UTC, deterministic)
  // =============================================
  /** Normalises an arbitrary date to the start of its period (UTC). */
  periodRange(
    periodType: GoalPeriodType,
    anchor: Date = new Date(),
  ): { periodStart: Date; periodEnd: Date } {
    if (periodType === GoalPeriodType.WEEKLY) {
      // ISO week: Monday 00:00Z inclusive, next Monday exclusive.
      const d = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
      );
      const day = d.getUTCDay(); // 0..6, Sunday=0
      const diffToMonday = (day + 6) % 7; // Monday -> 0
      d.setUTCDate(d.getUTCDate() - diffToMonday);
      const periodStart = new Date(d);
      const periodEnd = new Date(d);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);
      return { periodStart, periodEnd };
    }
    // MONTHLY
    const periodStart = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const periodEnd = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
    return { periodStart, periodEnd };
  }

  private parseAnchor(anchor?: string): Date {
    if (!anchor) return new Date();
    const d = new Date(anchor);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('periodAnchor must be a valid ISO date');
    }
    return d;
  }

  private isPercentageMetric(metric: GoalMetric): boolean {
    return metric === GoalMetric.CONVERSION_RATE || metric === GoalMetric.AI_ADOPTION_RATE;
  }

  // =============================================
  // CRUD
  // =============================================
  async create(companyId: string, createdById: string, dto: CreateGoalDto) {
    if (this.isPercentageMetric(dto.metric) && dto.target > 100) {
      throw new BadRequestException(`Target for ${dto.metric} must be 0..100 (percentage)`);
    }
    if (dto.userId) {
      const member = await this.prisma.user.findFirst({
        where: { id: dto.userId, companyId, isActive: true },
        select: { id: true },
      });
      if (!member) {
        throw new BadRequestException('userId is not a member of this tenant');
      }
    }

    const { periodStart, periodEnd } = this.periodRange(
      dto.periodType,
      this.parseAnchor(dto.periodAnchor),
    );

    try {
      const goal = await this.prisma.teamGoal.create({
        data: {
          companyId,
          userId: dto.userId ?? null,
          metric: dto.metric,
          target: dto.target,
          periodType: dto.periodType,
          periodStart,
          periodEnd,
          createdById,
        },
      });
      // Audit (non-blocking)
      void this.prisma.auditLog
        .create({
          data: {
            companyId,
            userId: createdById,
            action: AuditAction.CREATE,
            resource: 'TEAM_GOAL',
            resourceId: goal.id,
            description: `Goal created: ${dto.metric} target ${dto.target} (${dto.periodType})`,
            newValues: {
              metric: dto.metric,
              target: dto.target,
              periodStart: periodStart.toISOString(),
              userId: dto.userId ?? null,
            },
          },
        })
        .catch(() => undefined);
      return goal;
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException(
          'A goal already exists for this user/metric/period. Update the existing goal instead.',
        );
      }
      throw e;
    }
  }

  async listCurrent(companyId: string, periodType: GoalPeriodType = GoalPeriodType.WEEKLY) {
    const { periodStart } = this.periodRange(periodType);
    return this.prisma.teamGoal.findMany({
      where: { companyId, periodType, periodStart },
      orderBy: [{ userId: 'asc' }, { metric: 'asc' }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async updateTarget(companyId: string, goalId: string, actorId: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.teamGoal.findFirst({ where: { id: goalId, companyId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (this.isPercentageMetric(goal.metric) && dto.target > 100) {
      throw new BadRequestException('Percentage metrics must have target 0..100');
    }
    const updated = await this.prisma.teamGoal.update({
      where: { id: goalId },
      data: { target: dto.target },
    });
    void this.prisma.auditLog
      .create({
        data: {
          companyId,
          userId: actorId,
          action: AuditAction.UPDATE,
          resource: 'TEAM_GOAL',
          resourceId: goalId,
          oldValues: { target: goal.target },
          newValues: { target: dto.target },
        },
      })
      .catch(() => undefined);
    return updated;
  }

  async remove(companyId: string, goalId: string, actorId: string) {
    const goal = await this.prisma.teamGoal.findFirst({ where: { id: goalId, companyId } });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.prisma.teamGoal.delete({ where: { id: goalId } });
    void this.prisma.auditLog
      .create({
        data: {
          companyId,
          userId: actorId,
          action: AuditAction.DELETE,
          resource: 'TEAM_GOAL',
          resourceId: goalId,
        },
      })
      .catch(() => undefined);
    return { success: true };
  }

  // =============================================
  // LEADERBOARD
  // =============================================
  async leaderboard(
    companyId: string,
    periodType: GoalPeriodType = GoalPeriodType.WEEKLY,
  ): Promise<{
    period: { type: GoalPeriodType; start: string; end: string };
    rows: LeaderboardRow[];
  }> {
    const { periodStart, periodEnd } = this.periodRange(periodType);

    // Active users in tenant.
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        status: UserStatus.ACTIVE,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    if (users.length === 0) {
      return {
        period: {
          type: periodType,
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        rows: [],
      };
    }

    // Fetch all activity for the tenant in the period once, bucket by userId.
    const createdAt: Prisma.DateTimeFilter = { gte: periodStart, lt: periodEnd };
    const userIds = users.map((u) => u.id);

    const [calls, aiRows, waMessages, goals] = await Promise.all([
      this.prisma.call.findMany({
        where: { companyId, createdAt },
        select: { userId: true, status: true },
      }),
      // AISuggestion has no companyId column — scope via userId IN tenant users.
      this.prisma.aISuggestion.findMany({
        where: { userId: { in: userIds }, createdAt },
        select: { userId: true, wasUsed: true },
      }),
      this.prisma.whatsappMessage.findMany({
        where: {
          direction: 'OUTGOING',
          createdAt,
          chat: { companyId },
        },
        select: {
          chat: { select: { userId: true } },
        },
      }),
      this.prisma.teamGoal.findMany({
        where: { companyId, periodType, periodStart },
      }),
    ]);

    // Bucket activity per-user.
    const buckets = new Map<
      string,
      {
        callsTotal: number;
        callsCompleted: number;
        aiShown: number;
        aiUsed: number;
        waSent: number;
      }
    >();
    const getBucket = (id: string) => {
      let b = buckets.get(id);
      if (!b) {
        b = { callsTotal: 0, callsCompleted: 0, aiShown: 0, aiUsed: 0, waSent: 0 };
        buckets.set(id, b);
      }
      return b;
    };

    for (const c of calls) {
      const b = getBucket(c.userId);
      b.callsTotal += 1;
      if (c.status === 'COMPLETED') b.callsCompleted += 1;
    }
    for (const row of aiRows) {
      if (!row.userId) continue;
      const b = getBucket(row.userId);
      b.aiShown += 1;
      if (row.wasUsed === true) b.aiUsed += 1;
    }
    for (const msg of waMessages) {
      const uid = msg.chat?.userId;
      if (!uid) continue;
      getBucket(uid).waSent += 1;
    }

    // Build rows.
    const rows: LeaderboardRow[] = users.map((u) => {
      const b = buckets.get(u.id) ?? {
        callsTotal: 0,
        callsCompleted: 0,
        aiShown: 0,
        aiUsed: 0,
        waSent: 0,
      };
      const conversionRate =
        b.callsTotal > 0 ? Math.round((b.callsCompleted / b.callsTotal) * 100) : 0;
      const aiAdoptionRate = b.aiShown > 0 ? Math.round((b.aiUsed / b.aiShown) * 100) : 0;

      // Collect goals applicable to this user (per-vendor goals + company-wide).
      const applicableGoals = goals.filter((g) => g.userId === u.id || g.userId === null);
      const goalProgress = applicableGoals.map((g) => {
        const current = this.metricCurrentValue(g.metric, {
          callsTotal: b.callsTotal,
          callsCompleted: b.callsCompleted,
          conversionRate,
          aiAdoptionRate,
          whatsappMessagesSent: b.waSent,
        });
        const progressPct =
          g.target > 0 ? Math.min(100, Math.round((current / g.target) * 100)) : 0;
        return {
          id: g.id,
          metric: g.metric,
          target: g.target,
          current,
          progressPct,
          isCompanyWide: g.userId === null,
        };
      });

      const compositeScore =
        goalProgress.length > 0
          ? Math.round(
              goalProgress.reduce((sum, g) => sum + g.progressPct, 0) / goalProgress.length,
            )
          : 0;

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        metrics: {
          callsTotal: b.callsTotal,
          callsCompleted: b.callsCompleted,
          conversionRate,
          aiSuggestionsShown: b.aiShown,
          aiSuggestionsUsed: b.aiUsed,
          aiAdoptionRate,
          whatsappMessagesSent: b.waSent,
        },
        goals: goalProgress,
        compositeScore,
      };
    });

    // Rank: composite score DESC, then callsCompleted DESC as tiebreaker.
    rows.sort(
      (a, b) =>
        b.compositeScore - a.compositeScore || b.metrics.callsCompleted - a.metrics.callsCompleted,
    );

    return {
      period: {
        type: periodType,
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      rows,
    };
  }

  private metricCurrentValue(
    metric: GoalMetric,
    m: {
      callsTotal: number;
      callsCompleted: number;
      conversionRate: number;
      aiAdoptionRate: number;
      whatsappMessagesSent: number;
    },
  ): number {
    switch (metric) {
      case GoalMetric.CALLS_TOTAL:
        return m.callsTotal;
      case GoalMetric.CALLS_COMPLETED:
        return m.callsCompleted;
      case GoalMetric.CONVERSION_RATE:
        return m.conversionRate;
      case GoalMetric.AI_ADOPTION_RATE:
        return m.aiAdoptionRate;
      case GoalMetric.WHATSAPP_MESSAGES:
        return m.whatsappMessagesSent;
      default:
        return 0;
    }
  }
}
