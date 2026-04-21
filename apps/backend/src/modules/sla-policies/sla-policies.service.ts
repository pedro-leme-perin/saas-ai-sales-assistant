// =============================================
// 📄 SLA POLICIES SERVICE (Session 49)
// =============================================
// Design:
// - CRUD of SLA policies per ChatPriority (unique per company+priority).
// - @Cron every 2 minutes scans OPEN/PENDING/ACTIVE chats against their
//   policy, flags breaches on first-reply and resolution, writes a
//   Notification (SLA_ALERT) and emits SLA_BREACHED webhook event.
// - Bounded batch per tick (BATCH_SIZE=200) — Release It! bulkhead.
// - Idempotent: breach flags are one-shot booleans per chat (no duplicates).

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  ChatPriority,
  ChatStatus,
  ConfigResource,
  NotificationChannel,
  NotificationType,
  Prisma,
  SlaPolicy,
  WebhookEvent,
} from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';
import {
  WEBHOOK_EVENT_NAME,
  type WebhookEmitPayload,
} from '@modules/webhooks/events/webhook-events';
import {
  CONFIG_CHANGED_EVENT,
  type ConfigChangedPayload,
} from '../config-snapshots/events/config-events';
import { UpsertSlaPolicyDto } from './dto/upsert-sla-policy.dto';

@Injectable()
export class SlaPoliciesService {
  private readonly logger = new Logger(SlaPoliciesService.name);
  private static readonly MONITOR_BATCH = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ===== CRUD =====================================================

  async list(companyId: string): Promise<SlaPolicy[]> {
    this.assertTenant(companyId);
    return this.prisma.slaPolicy.findMany({
      where: { companyId },
      orderBy: { priority: 'asc' },
    });
  }

  async findById(companyId: string, id: string): Promise<SlaPolicy> {
    this.assertTenant(companyId);
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, companyId } });
    if (!policy) throw new NotFoundException('SLA policy not found');
    return policy;
  }

  async upsert(companyId: string, actorId: string, dto: UpsertSlaPolicyDto): Promise<SlaPolicy> {
    this.assertTenant(companyId);
    try {
      const row = await this.prisma.slaPolicy.upsert({
        where: {
          sla_company_priority_unique: { companyId, priority: dto.priority },
        },
        create: {
          companyId,
          name: dto.name,
          priority: dto.priority,
          responseMins: dto.responseMins,
          resolutionMins: dto.resolutionMins,
          isActive: dto.isActive ?? true,
        },
        update: {
          name: dto.name,
          responseMins: dto.responseMins,
          resolutionMins: dto.resolutionMins,
          isActive: dto.isActive ?? true,
        },
      });
      void this.audit(actorId, companyId, AuditAction.UPDATE, row.id, { dto });
      void this.eventEmitter.emit(CONFIG_CHANGED_EVENT, {
        companyId,
        actorId,
        resource: ConfigResource.SLA_POLICY,
        resourceId: row.id,
        label: `upsert SLA policy [${row.priority}]`,
      } satisfies ConfigChangedPayload);
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('SLA policy already exists for this priority');
      }
      throw err;
    }
  }

  async remove(companyId: string, actorId: string, id: string): Promise<{ success: true }> {
    const policy = await this.findById(companyId, id);
    await this.prisma.slaPolicy.delete({ where: { id: policy.id } });
    void this.audit(actorId, companyId, AuditAction.DELETE, policy.id, {
      priority: policy.priority,
    });
    void this.eventEmitter.emit(CONFIG_CHANGED_EVENT, {
      companyId,
      actorId,
      resource: ConfigResource.SLA_POLICY,
      resourceId: policy.id,
      label: `delete SLA policy [${policy.priority}]`,
    } satisfies ConfigChangedPayload);
    return { success: true };
  }

  // ===== Monitor cron =============================================

  @Cron(CronExpression.EVERY_MINUTE, { name: 'sla-monitor-tick' })
  async monitorTick(): Promise<void> {
    const now = new Date();
    const policies = await this.prisma.slaPolicy.findMany({
      where: { isActive: true },
    });
    if (policies.length === 0) return;

    const byKey = new Map<string, SlaPolicy>();
    for (const p of policies) byKey.set(`${p.companyId}:${p.priority}`, p);

    // Candidates: chats not yet fully breached, not resolved, not archived.
    const candidates = await this.prisma.whatsappChat.findMany({
      where: {
        status: { in: [ChatStatus.OPEN, ChatStatus.PENDING, ChatStatus.ACTIVE] },
        OR: [{ slaResponseBreached: false }, { slaResolutionBreached: false }],
      },
      take: SlaPoliciesService.MONITOR_BATCH,
      select: {
        id: true,
        companyId: true,
        priority: true,
        createdAt: true,
        firstAgentReplyAt: true,
        slaResponseBreached: true,
        slaResolutionBreached: true,
        customerName: true,
        userId: true,
      },
    });

    for (const chat of candidates) {
      const policy = byKey.get(`${chat.companyId}:${chat.priority}`);
      if (!policy) continue;
      try {
        await this.evaluateChat(chat, policy, now);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`SLA evaluate chat=${chat.id} failed: ${msg}`);
      }
    }
  }

  private async evaluateChat(
    chat: {
      id: string;
      companyId: string;
      priority: ChatPriority;
      createdAt: Date;
      firstAgentReplyAt: Date | null;
      slaResponseBreached: boolean;
      slaResolutionBreached: boolean;
      customerName: string | null;
      userId: string | null;
    },
    policy: SlaPolicy,
    now: Date,
  ): Promise<void> {
    const openedAtMs = chat.createdAt.getTime();
    const responseDeadline = openedAtMs + policy.responseMins * 60_000;
    const resolutionDeadline = openedAtMs + policy.resolutionMins * 60_000;

    const responseBreached =
      !chat.slaResponseBreached &&
      chat.firstAgentReplyAt === null &&
      now.getTime() > responseDeadline;

    const resolutionBreached = !chat.slaResolutionBreached && now.getTime() > resolutionDeadline;

    if (!responseBreached && !resolutionBreached) return;

    const data: Prisma.WhatsappChatUpdateInput = { slaBreachedAt: now };
    if (responseBreached) data.slaResponseBreached = true;
    if (resolutionBreached) data.slaResolutionBreached = true;
    await this.prisma.whatsappChat.update({ where: { id: chat.id }, data });

    await this.emitBreach(chat, policy, { responseBreached, resolutionBreached });
  }

  private async emitBreach(
    chat: {
      id: string;
      companyId: string;
      priority: ChatPriority;
      customerName: string | null;
      userId: string | null;
    },
    policy: SlaPolicy,
    kind: { responseBreached: boolean; resolutionBreached: boolean },
  ): Promise<void> {
    // In-app notification (non-blocking). Targets assigned agent if any;
    // otherwise fans out to company OWNER/ADMIN so breaches don't get lost.
    const recipients: string[] = [];
    if (chat.userId) {
      recipients.push(chat.userId);
    } else {
      const managers = await this.prisma.user.findMany({
        where: {
          companyId: chat.companyId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { id: true },
        take: 10,
      });
      for (const m of managers) recipients.push(m.id);
    }

    for (const recipientId of recipients) {
      try {
        await this.prisma.notification.create({
          data: {
            userId: recipientId,
            companyId: chat.companyId,
            type: NotificationType.SLA_ALERT,
            channel: NotificationChannel.IN_APP,
            title: 'SLA breach detectado',
            message:
              `Conversa ${chat.customerName ?? chat.id} [${chat.priority}] ` +
              (kind.responseBreached ? '• resposta atrasada ' : '') +
              (kind.resolutionBreached ? '• resolução atrasada' : ''),
            data: {
              chatId: chat.id,
              policyId: policy.id,
              responseBreached: kind.responseBreached,
              resolutionBreached: kind.resolutionBreached,
            } as Prisma.InputJsonValue,
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`SLA notification create failed: ${msg}`);
      }
    }

    // Webhook fan-out (non-blocking)
    try {
      const payload: WebhookEmitPayload = {
        companyId: chat.companyId,
        event: WebhookEvent.SLA_BREACHED,
        data: {
          chatId: chat.id,
          priority: chat.priority,
          policy: {
            id: policy.id,
            responseMins: policy.responseMins,
            resolutionMins: policy.resolutionMins,
          },
          responseBreached: kind.responseBreached,
          resolutionBreached: kind.resolutionBreached,
        },
      };
      this.eventEmitter.emit(WEBHOOK_EVENT_NAME, payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SLA webhook emit failed: ${msg}`);
    }
  }

  // ===== UTIL =====================================================

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
          userId,
          companyId,
          action,
          resource: 'SLA_POLICY',
          resourceId,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking: SLA audit log failed: ${msg}`);
    }
  }
}
