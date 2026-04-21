// =============================================
// 🚨 SlaEscalationService (Session 57 — Feature A2)
// =============================================
// Multi-tier escalation chain executed AFTER an SLA breach is flagged by
// SlaPoliciesService (S49). Each SlaEscalation row is a step bound to a
// policy (priority) via `(policyId, level)` unique index. A dispatch cron
// scans breached, still-open chats every minute and fires due levels.
//
// Dispatch rule:
//   breachElapsedMins = floor((now - chat.slaBreachedAt) / 60_000)
//   fire level if:
//     - escalation.isActive
//     - escalation.level NOT IN chat.slaEscalationsRun
//     - breachElapsedMins >= escalation.triggerAfterMins
//
// Actions:
//   NOTIFY_MANAGER       — create Notifications to targetUserIds OR
//                          fall back to company OWNER/ADMIN (≤10)
//   REASSIGN_TO_USER     — set chat.userId = targetUserIds[0] (first
//                          eligible ONLINE user is preferred; fallback
//                          first id)
//   CHANGE_PRIORITY      — bump chat.priority to targetPriority
//
// Idempotency:
//   `chat.slaEscalationsRun` String[] ledger — the escalation row id is
//   appended inside the same $transaction that performs the action. The
//   cron guard `{ NOT: { slaEscalationsRun: { has: escalation.id } } }`
//   plus the ledger append makes re-runs no-ops.
//
// Resilience:
//   - Release It! bulkhead: bounded batch (MONITOR_BATCH = 200).
//   - Error isolation per chat×level (try/catch, warn log).
//   - Fire-and-forget audit and webhook.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  ChatPriority,
  ChatStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
  SlaEscalation,
  SlaEscalationAction,
  WebhookEvent,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import {
  WEBHOOK_EVENT_NAME,
  type WebhookEmitPayload,
} from '@modules/webhooks/events/webhook-events';
import { PresenceService } from '@modules/presence/presence.service';
import { CreateSlaEscalationDto, UpdateSlaEscalationDto } from './dto/upsert-sla-escalation.dto';

interface BreachedChat {
  id: string;
  companyId: string;
  priority: ChatPriority;
  userId: string | null;
  customerName: string | null;
  slaBreachedAt: Date;
  slaEscalationsRun: string[];
}

const MONITOR_BATCH = 200;
const MAX_ESCALATIONS_PER_POLICY = 20;

@Injectable()
export class SlaEscalationService {
  private readonly logger = new Logger(SlaEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly presence: PresenceService,
  ) {}

  // ===== CRUD ============================================================

  async list(companyId: string, policyId?: string): Promise<SlaEscalation[]> {
    return this.prisma.slaEscalation.findMany({
      where: { companyId, ...(policyId ? { policyId } : {}) },
      orderBy: [{ policyId: 'asc' }, { level: 'asc' }],
      take: 500,
    });
  }

  async findById(companyId: string, id: string): Promise<SlaEscalation> {
    const row = await this.prisma.slaEscalation.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('SLA escalation not found');
    return row;
  }

  async create(
    companyId: string,
    actorId: string | null,
    dto: CreateSlaEscalationDto,
  ): Promise<SlaEscalation> {
    // Guard: policy belongs to this tenant
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { id: dto.policyId, companyId },
      select: { id: true },
    });
    if (!policy) throw new BadRequestException('policy not found for this tenant');

    // Guard: bounded number of levels per policy
    const count = await this.prisma.slaEscalation.count({
      where: { policyId: dto.policyId },
    });
    if (count >= MAX_ESCALATIONS_PER_POLICY) {
      throw new BadRequestException(
        `too many escalation levels (max ${MAX_ESCALATIONS_PER_POLICY})`,
      );
    }

    this.validateActionPayload(dto);

    try {
      const row = await this.prisma.slaEscalation.create({
        data: {
          companyId,
          policyId: dto.policyId,
          level: dto.level,
          triggerAfterMins: dto.triggerAfterMins,
          action: dto.action,
          targetUserIds: dto.targetUserIds ?? [],
          targetPriority: dto.targetPriority ?? null,
          isActive: dto.isActive ?? true,
        },
      });
      void this.audit(companyId, actorId, AuditAction.CREATE, row.id, { dto });
      return row;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('level already exists for this policy');
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    actorId: string | null,
    id: string,
    dto: UpdateSlaEscalationDto,
  ): Promise<SlaEscalation> {
    const existing = await this.findById(companyId, id);
    this.validateActionPayload({
      action: dto.action ?? existing.action,
      targetUserIds: dto.targetUserIds ?? existing.targetUserIds,
      targetPriority: dto.targetPriority ?? existing.targetPriority ?? undefined,
    });
    try {
      const updated = await this.prisma.slaEscalation.update({
        where: { id: existing.id },
        data: {
          ...(dto.level !== undefined ? { level: dto.level } : {}),
          ...(dto.triggerAfterMins !== undefined ? { triggerAfterMins: dto.triggerAfterMins } : {}),
          ...(dto.action !== undefined ? { action: dto.action } : {}),
          ...(dto.targetUserIds !== undefined ? { targetUserIds: dto.targetUserIds } : {}),
          ...(dto.targetPriority !== undefined ? { targetPriority: dto.targetPriority } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      void this.audit(companyId, actorId, AuditAction.UPDATE, id, {
        oldValues: this.slim(existing),
        newValues: dto,
      });
      return updated;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('level already exists for this policy');
      }
      throw err;
    }
  }

  async remove(companyId: string, actorId: string | null, id: string): Promise<void> {
    const existing = await this.findById(companyId, id);
    await this.prisma.slaEscalation.delete({ where: { id: existing.id } });
    void this.audit(companyId, actorId, AuditAction.DELETE, id, {
      level: existing.level,
      action: existing.action,
    });
  }

  // ===== Dispatch cron ===================================================

  @Cron(CronExpression.EVERY_MINUTE, { name: 'sla-escalation-dispatch' })
  async dispatchTick(): Promise<void> {
    const now = new Date();
    try {
      await this.processDueEscalations(now);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sla-escalation tick failed: ${msg}`);
    }
  }

  /**
   * Public for test access. Batched, bounded, error-isolated per chat.
   */
  async processDueEscalations(now: Date): Promise<{ fired: number }> {
    const chats = await this.prisma.whatsappChat.findMany({
      where: {
        slaBreachedAt: { not: null },
        status: { in: [ChatStatus.OPEN, ChatStatus.PENDING, ChatStatus.ACTIVE] },
      },
      take: MONITOR_BATCH,
      select: {
        id: true,
        companyId: true,
        priority: true,
        userId: true,
        customerName: true,
        slaBreachedAt: true,
        slaEscalationsRun: true,
      },
    });
    if (chats.length === 0) return { fired: 0 };

    // Load active escalations for the chat priorities present in the batch.
    const byCompanyPriority = new Map<string, BreachedChat[]>();
    for (const c of chats) {
      if (!c.slaBreachedAt) continue;
      const key = `${c.companyId}:${c.priority}`;
      const arr = byCompanyPriority.get(key) ?? [];
      arr.push(c as BreachedChat);
      byCompanyPriority.set(key, arr);
    }

    // Pull relevant escalations joined via policy.
    const escalations = await this.prisma.slaEscalation.findMany({
      where: {
        isActive: true,
        policy: {
          isActive: true,
          companyId: { in: Array.from(new Set(chats.map((c) => c.companyId))) },
        },
      },
      include: { policy: { select: { priority: true, companyId: true } } },
      orderBy: [{ level: 'asc' }],
    });

    const escalationsByKey = new Map<string, typeof escalations>();
    for (const e of escalations) {
      const key = `${e.policy.companyId}:${e.policy.priority}`;
      const arr = escalationsByKey.get(key) ?? [];
      arr.push(e);
      escalationsByKey.set(key, arr);
    }

    let fired = 0;
    for (const [key, chatGroup] of byCompanyPriority.entries()) {
      const escGroup = escalationsByKey.get(key);
      if (!escGroup || escGroup.length === 0) continue;

      for (const chat of chatGroup) {
        for (const esc of escGroup) {
          try {
            const didFire = await this.fireEscalationIfDue(chat, esc, now);
            if (didFire) fired += 1;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`escalation fire failed chat=${chat.id} esc=${esc.id}: ${msg}`);
          }
        }
      }
    }
    return { fired };
  }

  private async fireEscalationIfDue(
    chat: BreachedChat,
    esc: SlaEscalation,
    now: Date,
  ): Promise<boolean> {
    if (chat.slaEscalationsRun.includes(esc.id)) return false;
    const elapsedMs = now.getTime() - chat.slaBreachedAt.getTime();
    const triggerMs = esc.triggerAfterMins * 60_000;
    if (elapsedMs < triggerMs) return false;

    // Dispatch the action. Mutations happen inside a $transaction that also
    // appends the ledger — either both succeed or both roll back.
    await this.applyAction(chat, esc);

    // Side-effects (non-blocking, post-commit):
    void this.emitWebhook(chat, esc);
    return true;
  }

  private async applyAction(chat: BreachedChat, esc: SlaEscalation): Promise<void> {
    switch (esc.action) {
      case SlaEscalationAction.NOTIFY_MANAGER: {
        const recipientIds = await this.resolveNotifyRecipients(chat, esc);
        await this.prisma.$transaction([
          ...recipientIds.map((userId) =>
            this.prisma.notification.create({
              data: {
                userId,
                companyId: chat.companyId,
                type: NotificationType.SLA_ALERT,
                channel: NotificationChannel.IN_APP,
                title: `SLA escalation nível ${esc.level}`,
                message: `Conversa ${chat.customerName ?? chat.id} [${chat.priority}] escalada após ${esc.triggerAfterMins}min`,
                data: {
                  chatId: chat.id,
                  escalationId: esc.id,
                  level: esc.level,
                } as Prisma.InputJsonValue,
              },
            }),
          ),
          this.prisma.whatsappChat.update({
            where: { id: chat.id },
            data: { slaEscalationsRun: { push: esc.id } },
          }),
        ]);
        void this.audit(chat.companyId, null, AuditAction.UPDATE, chat.id, {
          action: 'sla-escalation-notify',
          escalationId: esc.id,
          recipients: recipientIds.length,
        });
        return;
      }

      case SlaEscalationAction.REASSIGN_TO_USER: {
        const nextUserId = await this.pickReassignTarget(chat.companyId, esc);
        if (!nextUserId) {
          // No eligible target — still mark level as run to avoid tight loop.
          await this.prisma.whatsappChat.update({
            where: { id: chat.id },
            data: { slaEscalationsRun: { push: esc.id } },
          });
          this.logger.warn(`REASSIGN_TO_USER skipped (no target) chat=${chat.id} esc=${esc.id}`);
          return;
        }
        await this.prisma.$transaction([
          this.prisma.whatsappChat.update({
            where: { id: chat.id },
            data: {
              userId: nextUserId,
              slaEscalationsRun: { push: esc.id },
            },
          }),
        ]);
        void this.audit(chat.companyId, null, AuditAction.UPDATE, chat.id, {
          action: 'sla-escalation-reassign',
          escalationId: esc.id,
          fromUserId: chat.userId,
          toUserId: nextUserId,
        });
        return;
      }

      case SlaEscalationAction.CHANGE_PRIORITY: {
        if (!esc.targetPriority) {
          await this.prisma.whatsappChat.update({
            where: { id: chat.id },
            data: { slaEscalationsRun: { push: esc.id } },
          });
          return;
        }
        await this.prisma.$transaction([
          this.prisma.whatsappChat.update({
            where: { id: chat.id },
            data: {
              priority: esc.targetPriority,
              slaEscalationsRun: { push: esc.id },
            },
          }),
        ]);
        void this.audit(chat.companyId, null, AuditAction.UPDATE, chat.id, {
          action: 'sla-escalation-change-priority',
          escalationId: esc.id,
          fromPriority: chat.priority,
          toPriority: esc.targetPriority,
        });
        return;
      }
    }
  }

  private async resolveNotifyRecipients(chat: BreachedChat, esc: SlaEscalation): Promise<string[]> {
    if (esc.targetUserIds.length > 0) {
      // Validate tenant ownership defensively — stale ids drop silently.
      const owned = await this.prisma.user.findMany({
        where: {
          companyId: chat.companyId,
          id: { in: esc.targetUserIds },
          isActive: true,
        },
        select: { id: true },
      });
      return owned.map((u) => u.id);
    }
    const managers = await this.prisma.user.findMany({
      where: {
        companyId: chat.companyId,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { id: true },
      take: 10,
    });
    return managers.map((m) => m.id);
  }

  private async pickReassignTarget(companyId: string, esc: SlaEscalation): Promise<string | null> {
    if (esc.targetUserIds.length === 0) return null;
    // Validate ownership
    const owned = await this.prisma.user.findMany({
      where: { companyId, id: { in: esc.targetUserIds }, isActive: true },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((u) => u.id));
    const valid = esc.targetUserIds.filter((id) => ownedIds.has(id));
    if (valid.length === 0) return null;

    // Prefer ONLINE + not-at-capacity; fallback to first valid id.
    try {
      const cap = await this.presence.getCapacityMap(companyId, valid);
      for (const id of valid) {
        const c = cap.get(id);
        if (c && c.isOnline && !c.atCapacity) return id;
      }
    } catch {
      // presence lookup failure is non-fatal — fallback below
    }
    return valid[0] ?? null;
  }

  private emitWebhook(chat: BreachedChat, esc: SlaEscalation): void {
    try {
      const payload: WebhookEmitPayload = {
        companyId: chat.companyId,
        event: WebhookEvent.SLA_ESCALATED,
        data: {
          chatId: chat.id,
          escalationId: esc.id,
          level: esc.level,
          action: esc.action,
          triggerAfterMins: esc.triggerAfterMins,
          priority: chat.priority,
        },
      };
      this.eventEmitter.emit(WEBHOOK_EVENT_NAME, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sla-escalation webhook emit failed: ${msg}`);
    }
  }

  // ===== Helpers =========================================================

  private validateActionPayload(input: {
    action: SlaEscalationAction;
    targetUserIds?: string[] | null;
    targetPriority?: ChatPriority | null;
  }): void {
    if (input.action === SlaEscalationAction.REASSIGN_TO_USER) {
      if (!input.targetUserIds || input.targetUserIds.length === 0) {
        throw new BadRequestException('REASSIGN_TO_USER requires targetUserIds');
      }
    }
    if (input.action === SlaEscalationAction.CHANGE_PRIORITY) {
      if (!input.targetPriority) {
        throw new BadRequestException('CHANGE_PRIORITY requires targetPriority');
      }
    }
  }

  private slim(row: SlaEscalation): Record<string, unknown> {
    return {
      level: row.level,
      triggerAfterMins: row.triggerAfterMins,
      action: row.action,
      targetUserIds: row.targetUserIds,
      targetPriority: row.targetPriority,
      isActive: row.isActive,
    };
  }

  private async audit(
    companyId: string,
    userId: string | null,
    action: AuditAction,
    resourceId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'SLA_ESCALATION',
          resourceId,
          newValues: values as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sla-escalation audit failed: ${msg}`);
    }
  }
}
