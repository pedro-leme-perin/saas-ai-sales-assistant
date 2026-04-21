// =============================================
// 📸 ConfigSnapshotsService (Session 58 — Feature A2)
// =============================================
// Point-in-time snapshots of tenant configuration + diff/rollback workflow.
//
// Supported resources (ConfigResource enum):
//   - COMPANY_SETTINGS          → Company.settings JSON
//   - FEATURE_FLAG              → single FeatureFlag row (by resourceId = flag id)
//   - SLA_POLICY                → single SlaPolicy row (by resourceId = policy id)
//   - ASSIGNMENT_RULE           → single AssignmentRule row (by resourceId = rule id)
//   - NOTIFICATION_PREFERENCES  → all NotificationPreference rows for a user
//                                 (resourceId = userId)
//
// Design notes:
//   - Snapshots are immutable records (no UPDATE). Rollback creates a NEW
//     pre-rollback snapshot first (labeled "pre-rollback of <id>") so every
//     rollback is itself reversible.
//   - Rollback uses $transaction: write pre-rollback snapshot → mutate live
//     row(s) → persist audit ROLLBACK. Atomic; partial failures never leak.
//   - @OnEvent('config.changed') ingests mutations from feature-flags,
//     sla-policies, assignment-rules, notification-preferences, companies.
//     Listener is fire-and-forget (hot path protected via try/catch).

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AuditAction,
  ConfigResource,
  ConfigSnapshot,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import {
  CONFIG_CHANGED_EVENT,
  type ConfigChangedPayload,
} from './events/config-events';

export interface SnapshotDiff {
  snapshotId: string;
  resource: ConfigResource;
  resourceId: string | null;
  createdAt: Date;
  snapshotData: Prisma.JsonValue;
  currentData: Prisma.JsonValue | null;
  changed: boolean;
}

@Injectable()
export class ConfigSnapshotsService {
  private readonly logger = new Logger(ConfigSnapshotsService.name);
  private static readonly LIST_DEFAULT_LIMIT = 50;
  private static readonly LIST_MAX_LIMIT = 200;

  constructor(private readonly prisma: PrismaService) {}

  // ===== Public CRUD ===================================================

  async list(
    companyId: string,
    filter: { resource?: ConfigResource; resourceId?: string; limit?: number },
  ): Promise<ConfigSnapshot[]> {
    this.assertTenant(companyId);
    const take = Math.min(
      Math.max(1, filter.limit ?? ConfigSnapshotsService.LIST_DEFAULT_LIMIT),
      ConfigSnapshotsService.LIST_MAX_LIMIT,
    );
    return this.prisma.configSnapshot.findMany({
      where: {
        companyId,
        ...(filter.resource ? { resource: filter.resource } : {}),
        ...(filter.resourceId ? { resourceId: filter.resourceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async findById(companyId: string, id: string): Promise<ConfigSnapshot> {
    this.assertTenant(companyId);
    const row = await this.prisma.configSnapshot.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('snapshot not found');
    return row;
  }

  async create(
    companyId: string,
    actorId: string | null,
    dto: CreateSnapshotDto,
  ): Promise<ConfigSnapshot> {
    this.assertTenant(companyId);
    const data = await this.captureLiveState(
      companyId,
      dto.resource,
      dto.resourceId ?? null,
    );
    return this.prisma.configSnapshot.create({
      data: {
        companyId,
        createdById: actorId,
        resource: dto.resource,
        resourceId: dto.resourceId ?? null,
        label: dto.label ?? null,
        snapshotData: data as Prisma.InputJsonValue,
      },
    });
  }

  async diff(companyId: string, id: string): Promise<SnapshotDiff> {
    const snap = await this.findById(companyId, id);
    const current = await this.captureLiveState(
      companyId,
      snap.resource,
      snap.resourceId,
    ).catch(() => null);
    return {
      snapshotId: snap.id,
      resource: snap.resource,
      resourceId: snap.resourceId,
      createdAt: snap.createdAt,
      snapshotData: snap.snapshotData,
      currentData: current as Prisma.JsonValue | null,
      changed: JSON.stringify(snap.snapshotData) !== JSON.stringify(current),
    };
  }

  async rollback(
    companyId: string,
    actorId: string,
    id: string,
  ): Promise<{ success: true; preRollbackSnapshotId: string }> {
    const snap = await this.findById(companyId, id);

    // Pre-capture current state OUTSIDE the transaction to keep live-state
    // fetch (which may hit multiple tables) off the tx timeout budget.
    const liveBefore = await this.captureLiveState(
      companyId,
      snap.resource,
      snap.resourceId,
    ).catch(() => null);

    const preSnapshotData =
      liveBefore ?? (snap.snapshotData as unknown as Record<string, unknown>);

    const result = await this.prisma.$transaction(async (tx) => {
      const pre = await tx.configSnapshot.create({
        data: {
          companyId,
          createdById: actorId,
          resource: snap.resource,
          resourceId: snap.resourceId,
          label: `pre-rollback of ${snap.id}`,
          snapshotData: preSnapshotData as Prisma.InputJsonValue,
        },
      });

      await this.applyRollback(tx, companyId, snap);

      await tx.auditLog.create({
        data: {
          companyId,
          userId: actorId,
          action: AuditAction.ROLLBACK,
          resource: 'CONFIG_SNAPSHOT',
          resourceId: snap.id,
          newValues: {
            rolledBackTo: snap.id,
            preRollbackSnapshotId: pre.id,
            targetResource: snap.resource,
            targetResourceId: snap.resourceId,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { preRollbackSnapshotId: pre.id };
    });

    return { success: true, preRollbackSnapshotId: result.preRollbackSnapshotId };
  }

  // ===== Event ingestion ==============================================

  @OnEvent(CONFIG_CHANGED_EVENT)
  async handleConfigChanged(payload: ConfigChangedPayload): Promise<void> {
    try {
      await this.create(payload.companyId, payload.actorId ?? null, {
        resource: payload.resource,
        resourceId: payload.resourceId ?? undefined,
        label: payload.label ?? undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Non-blocking: config snapshot ingest failed (${payload.resource}): ${msg}`,
      );
    }
  }

  // ===== Live-state capture ===========================================

  private async captureLiveState(
    companyId: string,
    resource: ConfigResource,
    resourceId: string | null,
  ): Promise<Record<string, unknown>> {
    switch (resource) {
      case ConfigResource.COMPANY_SETTINGS: {
        const company = await this.prisma.company.findFirst({
          where: { id: companyId },
          select: { settings: true, name: true, plan: true, timezone: true },
        });
        if (!company) throw new NotFoundException('company not found');
        return {
          settings: company.settings ?? {},
          name: company.name,
          plan: company.plan,
          timezone: company.timezone,
        };
      }
      case ConfigResource.FEATURE_FLAG: {
        if (!resourceId) throw new BadRequestException('resourceId required for FEATURE_FLAG');
        const flag = await this.prisma.featureFlag.findFirst({
          where: { id: resourceId, companyId },
        });
        if (!flag) throw new NotFoundException('feature flag not found');
        return this.plainOf(flag);
      }
      case ConfigResource.SLA_POLICY: {
        if (!resourceId) throw new BadRequestException('resourceId required for SLA_POLICY');
        const policy = await this.prisma.slaPolicy.findFirst({
          where: { id: resourceId, companyId },
        });
        if (!policy) throw new NotFoundException('sla policy not found');
        return this.plainOf(policy);
      }
      case ConfigResource.ASSIGNMENT_RULE: {
        if (!resourceId) throw new BadRequestException('resourceId required for ASSIGNMENT_RULE');
        const rule = await this.prisma.assignmentRule.findFirst({
          where: { id: resourceId, companyId },
        });
        if (!rule) throw new NotFoundException('assignment rule not found');
        return this.plainOf(rule);
      }
      case ConfigResource.NOTIFICATION_PREFERENCES: {
        if (!resourceId)
          throw new BadRequestException('resourceId (userId) required for NOTIFICATION_PREFERENCES');
        const prefs = await this.prisma.notificationPreference.findMany({
          where: { companyId, userId: resourceId },
          orderBy: [{ type: 'asc' }, { channel: 'asc' }],
        });
        return { userId: resourceId, items: prefs.map((p) => this.plainOf(p)) };
      }
      default:
        throw new BadRequestException('unsupported resource');
    }
  }

  // ===== Rollback application =========================================

  private async applyRollback(
    tx: Prisma.TransactionClient,
    companyId: string,
    snap: ConfigSnapshot,
  ): Promise<void> {
    const data = snap.snapshotData as unknown as Record<string, unknown>;

    switch (snap.resource) {
      case ConfigResource.COMPANY_SETTINGS: {
        await tx.company.update({
          where: { id: companyId },
          data: {
            settings: (data.settings ?? {}) as Prisma.InputJsonValue,
            ...(typeof data.name === 'string' ? { name: data.name as string } : {}),
            ...(typeof data.timezone === 'string'
              ? { timezone: data.timezone as string }
              : {}),
          },
        });
        return;
      }
      case ConfigResource.FEATURE_FLAG: {
        if (!snap.resourceId) throw new BadRequestException('snapshot missing resourceId');
        const { enabled, rolloutPercentage, userAllowlist, name, description } =
          data as {
            enabled?: boolean;
            rolloutPercentage?: number;
            userAllowlist?: string[];
            name?: string;
            description?: string | null;
          };
        // Defensive guard: only update if the flag still exists (prevents
        // re-creating soft-deleted config). Callers must re-create manually.
        const exists = await tx.featureFlag.findFirst({
          where: { id: snap.resourceId, companyId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('feature flag no longer exists');
        await tx.featureFlag.update({
          where: { id: snap.resourceId },
          data: {
            ...(typeof enabled === 'boolean' ? { enabled } : {}),
            ...(typeof rolloutPercentage === 'number' ? { rolloutPercentage } : {}),
            ...(Array.isArray(userAllowlist) ? { userAllowlist } : {}),
            ...(typeof name === 'string' ? { name } : {}),
            ...(description !== undefined ? { description: description ?? null } : {}),
          },
        });
        return;
      }
      case ConfigResource.SLA_POLICY: {
        if (!snap.resourceId) throw new BadRequestException('snapshot missing resourceId');
        const { name, responseMins, resolutionMins, isActive } = data as {
          name?: string;
          responseMins?: number;
          resolutionMins?: number;
          isActive?: boolean;
        };
        const exists = await tx.slaPolicy.findFirst({
          where: { id: snap.resourceId, companyId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('sla policy no longer exists');
        await tx.slaPolicy.update({
          where: { id: snap.resourceId },
          data: {
            ...(typeof name === 'string' ? { name } : {}),
            ...(typeof responseMins === 'number' ? { responseMins } : {}),
            ...(typeof resolutionMins === 'number' ? { resolutionMins } : {}),
            ...(typeof isActive === 'boolean' ? { isActive } : {}),
          },
        });
        return;
      }
      case ConfigResource.ASSIGNMENT_RULE: {
        if (!snap.resourceId) throw new BadRequestException('snapshot missing resourceId');
        const {
          name,
          priority,
          strategy,
          conditions,
          targetUserIds,
          isActive,
        } = data as {
          name?: string;
          priority?: number;
          strategy?: string;
          conditions?: unknown;
          targetUserIds?: string[];
          isActive?: boolean;
        };
        const exists = await tx.assignmentRule.findFirst({
          where: { id: snap.resourceId, companyId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('assignment rule no longer exists');
        await tx.assignmentRule.update({
          where: { id: snap.resourceId },
          data: {
            ...(typeof name === 'string' ? { name } : {}),
            ...(typeof priority === 'number' ? { priority } : {}),
            ...(strategy
              ? { strategy: strategy as Prisma.AssignmentRuleUpdateInput['strategy'] }
              : {}),
            ...(conditions !== undefined
              ? { conditions: (conditions ?? {}) as Prisma.InputJsonValue }
              : {}),
            ...(Array.isArray(targetUserIds) ? { targetUserIds } : {}),
            ...(typeof isActive === 'boolean' ? { isActive } : {}),
          },
        });
        return;
      }
      case ConfigResource.NOTIFICATION_PREFERENCES: {
        if (!snap.resourceId)
          throw new BadRequestException('snapshot missing userId (resourceId)');
        const { items } = data as { items?: Array<Record<string, unknown>> };
        if (!Array.isArray(items)) {
          throw new BadRequestException('snapshot payload missing items[]');
        }
        // Replace semantics: wipe the user's current matrix, then re-seed
        // from the snapshot. Safer than per-row upsert because it handles
        // rows that existed at snapshot time but were later deleted.
        await tx.notificationPreference.deleteMany({
          where: { companyId, userId: snap.resourceId },
        });
        for (const item of items) {
          try {
            await tx.notificationPreference.create({
              data: {
                companyId,
                userId: snap.resourceId,
                type: item.type as Prisma.NotificationPreferenceCreateInput['type'],
                channel:
                  item.channel as Prisma.NotificationPreferenceCreateInput['channel'],
                enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
                quietHoursStart: (item.quietHoursStart as string | null) ?? null,
                quietHoursEnd: (item.quietHoursEnd as string | null) ?? null,
                timezone: (item.timezone as string | null) ?? null,
                digestMode: typeof item.digestMode === 'boolean' ? item.digestMode : false,
              },
            });
          } catch (err: unknown) {
            // Skip malformed rows; continue restoring the rest.
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Skipping pref row in rollback: ${msg}`);
          }
        }
        return;
      }
      default:
        throw new BadRequestException('unsupported resource');
    }
  }

  // ===== Helpers =======================================================

  private plainOf<T extends object>(row: T): Record<string, unknown> {
    // Serialize through JSON to drop Prisma Date/Decimal prototypes. Keeps the
    // snapshot byte-stable for diff comparisons.
    return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
  }

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }
}
