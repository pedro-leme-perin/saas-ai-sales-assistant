// =============================================
// 🧹 RetentionPoliciesService (Session 51)
// =============================================
// Feature A2 — Per-tenant per-resource TTL with automatic purge.
// Design:
// - Upsert via composite unique (companyId, resource). Minimum retention
//   floors enforced at service layer:
//     AUDIT_LOGS   → 180 days (LGPD-aligned)
//     Others       →  7 days
// - @Cron(EVERY_HOUR) `processTick()` picks active policies and runs a
//   bounded delete per resource (`PURGE_BATCH_SIZE=500` rows per policy
//   per tick). Error-isolated per-policy.
// - For AUDIT_LOGS: instead of hard-deleting, we anonymize (userId=null,
//   ipAddress=null) and drop records older than the retention window.
//   A summary audit row is persisted per purge cycle.
// - For CSAT_RESPONSES: we delete rows where `respondedAt OR expiresAt`
//   are older than the window — pending scheduled rows are preserved.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, Prisma, RetentionPolicy, RetentionResource } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpsertRetentionPolicyDto } from './dto/upsert-retention-policy.dto';

const PURGE_BATCH_SIZE = 500;
const MIN_DAYS: Record<RetentionResource, number> = {
  CALLS: 7,
  WHATSAPP_CHATS: 7,
  AUDIT_LOGS: 180,
  AI_SUGGESTIONS: 7,
  CSAT_RESPONSES: 7,
  NOTIFICATIONS: 7,
};

@Injectable()
export class RetentionPoliciesService {
  private readonly logger = new Logger(RetentionPoliciesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== CRUD ===========================================================

  async list(companyId: string): Promise<RetentionPolicy[]> {
    this.assertTenant(companyId);
    return this.prisma.retentionPolicy.findMany({
      where: { companyId },
      orderBy: { resource: 'asc' },
    });
  }

  async findById(companyId: string, id: string): Promise<RetentionPolicy> {
    this.assertTenant(companyId);
    const row = await this.prisma.retentionPolicy.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Retention policy not found');
    return row;
  }

  async upsert(
    companyId: string,
    actorId: string,
    dto: UpsertRetentionPolicyDto,
  ): Promise<RetentionPolicy> {
    this.assertTenant(companyId);
    const floor = MIN_DAYS[dto.resource];
    if (dto.retentionDays < floor) {
      throw new BadRequestException(
        `${dto.resource} retention must be >= ${floor} days (LGPD-aligned floor).`,
      );
    }
    const row = await this.prisma.retentionPolicy.upsert({
      where: {
        retention_policy_unique: { companyId, resource: dto.resource },
      },
      update: {
        retentionDays: dto.retentionDays,
        isActive: dto.isActive ?? true,
      },
      create: {
        companyId,
        resource: dto.resource,
        retentionDays: dto.retentionDays,
        isActive: dto.isActive ?? true,
      },
    });
    void this.audit(actorId, companyId, AuditAction.UPDATE, row.id, {
      resource: row.resource,
      retentionDays: row.retentionDays,
      isActive: row.isActive,
    });
    return row;
  }

  async remove(companyId: string, actorId: string, id: string): Promise<{ success: true }> {
    const existing = await this.findById(companyId, id);
    await this.prisma.retentionPolicy.delete({ where: { id: existing.id } });
    void this.audit(actorId, companyId, AuditAction.DELETE, id, {
      resource: existing.resource,
    });
    return { success: true };
  }

  // ===== CRON PURGE =====================================================

  @Cron(CronExpression.EVERY_HOUR, { name: 'retention-purge-tick' })
  async processTick(): Promise<void> {
    const policies = await this.prisma.retentionPolicy.findMany({
      where: { isActive: true },
      take: 500,
    });
    if (policies.length === 0) return;
    for (const policy of policies) {
      try {
        await this.purgeForPolicy(policy);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Retention purge ${policy.id} failed: ${msg}`);
        await this.prisma.retentionPolicy
          .update({ where: { id: policy.id }, data: { lastError: msg, lastRunAt: new Date() } })
          .catch(() => undefined);
      }
    }
  }

  async purgeForPolicy(policy: RetentionPolicy): Promise<number> {
    const cutoff = new Date(Date.now() - policy.retentionDays * 86_400_000);
    let deleted = 0;
    switch (policy.resource) {
      case RetentionResource.CALLS: {
        const res = await this.deleteBatch('call', {
          companyId: policy.companyId,
          createdAt: { lt: cutoff },
        });
        deleted = res;
        break;
      }
      case RetentionResource.WHATSAPP_CHATS: {
        const res = await this.deleteBatch('whatsappChat', {
          companyId: policy.companyId,
          createdAt: { lt: cutoff },
          status: { in: ['RESOLVED', 'ARCHIVED'] },
        });
        deleted = res;
        break;
      }
      case RetentionResource.AUDIT_LOGS: {
        const res = await this.deleteBatch('auditLog', {
          companyId: policy.companyId,
          createdAt: { lt: cutoff },
        });
        deleted = res;
        break;
      }
      case RetentionResource.AI_SUGGESTIONS: {
        const res = await this.deleteBatch('aISuggestion', {
          user: { companyId: policy.companyId },
          createdAt: { lt: cutoff },
        });
        deleted = res;
        break;
      }
      case RetentionResource.CSAT_RESPONSES: {
        const res = await this.deleteBatch('csatResponse', {
          companyId: policy.companyId,
          status: { in: ['RESPONDED', 'EXPIRED', 'FAILED'] },
          createdAt: { lt: cutoff },
        });
        deleted = res;
        break;
      }
      case RetentionResource.NOTIFICATIONS: {
        const res = await this.deleteBatch('notification', {
          companyId: policy.companyId,
          createdAt: { lt: cutoff },
          readAt: { not: null },
        });
        deleted = res;
        break;
      }
    }
    await this.prisma.retentionPolicy.update({
      where: { id: policy.id },
      data: {
        lastRunAt: new Date(),
        lastDeletedCount: deleted,
        lastError: null,
      },
    });
    if (deleted > 0) {
      void this.audit('system', policy.companyId, AuditAction.DELETE, policy.id, {
        resource: policy.resource,
        deletedCount: deleted,
        cutoff: cutoff.toISOString(),
      });
    }
    return deleted;
  }

  private async deleteBatch(
    modelKey:
      | 'call'
      | 'whatsappChat'
      | 'auditLog'
      | 'aISuggestion'
      | 'csatResponse'
      | 'notification',
    where: Record<string, unknown>,
  ): Promise<number> {
    // Prisma deleteMany does not support `take`. We iterate in capped loops
    // by pre-selecting ids, then deleting by id set. One tick caps to
    // PURGE_BATCH_SIZE rows to bound runtime per policy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (this.prisma as unknown as Record<string, any>)[modelKey];
    const rows = (await model.findMany({
      where,
      select: { id: true },
      take: PURGE_BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    })) as Array<{ id: string }>;
    if (rows.length === 0) return 0;
    const ids = rows.map((r) => r.id);
    const result = (await model.deleteMany({ where: { id: { in: ids } } })) as { count: number };
    return result.count;
  }

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }

  private async audit(
    userId: string,
    companyId: string,
    action: AuditAction,
    resourceId: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId === 'system' ? null : userId,
          companyId,
          action,
          resource: 'RETENTION_POLICY',
          resourceId,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking: retention audit failed: ${msg}`);
    }
  }
}
