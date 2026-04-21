// =============================================
// 📅 SCHEDULED MESSAGES SERVICE (Session 56)
// =============================================
// Feature A1 — Queued outbound WhatsApp messages dispatched by BackgroundJobs worker.
//
// Pipeline:
//   1) schedule(companyId, actorId, chatId, dto) → validates future timestamp,
//      creates ScheduledMessage row (PENDING), enqueues BackgroundJob
//      (type=SEND_SCHEDULED_MESSAGE, runAt=scheduledAt, payload={messageId}).
//   2) BackgroundJobs cron picks up the job at runAt, dispatches to our
//      handler registered via OnModuleInit (S49 pattern).
//   3) Handler re-reads the message, guards against CANCELED, calls
//      WhatsappService.sendMessage, flips row to SENT or FAILED.
//
// Resilience:
//   - cancel() is idempotent — PENDING → CANCELED, BG job is also canceled if still pending.
//   - Handler is resilient to row-already-CANCELED race (skip send).
//   - Error isolation: per-message failure doesn't bounce the worker tick (S49 handles).
//   - Audit fire-and-forget in all mutations.
//   - Tenant scoping enforced on every read via findFirst {companyId}.

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  AuditAction,
  BackgroundJob,
  BackgroundJobStatus,
  BackgroundJobType,
  Prisma,
  ScheduledMessage,
  ScheduledMessageStatus,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { BackgroundJobsService } from '@modules/background-jobs/background-jobs.service';
import { WhatsappService } from '@modules/whatsapp/whatsapp.service';

import { CreateScheduledMessageDto } from './dto/create-scheduled-message.dto';

const MIN_LEAD_SECONDS = 30;
const MAX_LEAD_DAYS = 60;

@Injectable()
export class ScheduledMessagesService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: BackgroundJobsService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsapp: WhatsappService,
  ) {}

  onModuleInit(): void {
    this.jobs.registerHandler(BackgroundJobType.SEND_SCHEDULED_MESSAGE, (job) =>
      this.handleSend(job),
    );
  }

  // ===== Public API ==============================================

  async schedule(
    companyId: string,
    actorId: string | null,
    chatId: string,
    dto: CreateScheduledMessageDto,
  ): Promise<ScheduledMessage> {
    this.assertTenant(companyId);
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }
    const now = Date.now();
    const leadMs = scheduledAt.getTime() - now;
    if (leadMs < MIN_LEAD_SECONDS * 1000) {
      throw new BadRequestException(`scheduledAt must be at least ${MIN_LEAD_SECONDS}s in the future`);
    }
    if (leadMs > MAX_LEAD_DAYS * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`scheduledAt must be within ${MAX_LEAD_DAYS} days`);
    }

    const chat = await this.prisma.whatsappChat.findFirst({
      where: { id: chatId, companyId },
      select: { id: true },
    });
    if (!chat) throw new NotFoundException('Chat not found');

    const message = await this.prisma.scheduledMessage.create({
      data: {
        companyId,
        chatId,
        createdById: actorId,
        content: dto.content,
        mediaUrl: dto.mediaUrl ?? null,
        scheduledAt,
        status: ScheduledMessageStatus.PENDING,
      },
    });

    let jobId: string | null = null;
    try {
      const job = await this.jobs.enqueue(companyId, actorId, {
        type: BackgroundJobType.SEND_SCHEDULED_MESSAGE,
        payload: { messageId: message.id } as Record<string, unknown>,
        runAt: scheduledAt,
        maxAttempts: 3,
      });
      jobId = job.id;
    } catch (err) {
      this.logger.error(`Failed to enqueue job for scheduled message ${message.id}: ${String(err)}`);
      await this.prisma.scheduledMessage.update({
        where: { id: message.id },
        data: {
          status: ScheduledMessageStatus.FAILED,
          lastError: 'enqueue_failed',
        },
      });
      throw new BadRequestException('Failed to enqueue scheduled message');
    }

    const persisted = await this.prisma.scheduledMessage.update({
      where: { id: message.id },
      data: { jobId },
    });
    void this.audit(companyId, actorId, AuditAction.CREATE, message.id, {
      newValues: { chatId, scheduledAt: scheduledAt.toISOString(), jobId },
    });
    return persisted;
  }

  async list(
    companyId: string,
    filters: {
      chatId?: string;
      status?: ScheduledMessageStatus;
      limit?: number;
    } = {},
  ): Promise<ScheduledMessage[]> {
    this.assertTenant(companyId);
    const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    return this.prisma.scheduledMessage.findMany({
      where: {
        companyId,
        ...(filters.chatId ? { chatId: filters.chatId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take,
    });
  }

  async findById(companyId: string, id: string): Promise<ScheduledMessage> {
    this.assertTenant(companyId);
    const row = await this.prisma.scheduledMessage.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Scheduled message not found');
    return row;
  }

  async cancel(
    companyId: string,
    actorId: string | null,
    id: string,
  ): Promise<ScheduledMessage> {
    const existing = await this.findById(companyId, id);
    if (existing.status !== ScheduledMessageStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel message in status ${existing.status}`);
    }

    const updated = await this.prisma.scheduledMessage.update({
      where: { id },
      data: { status: ScheduledMessageStatus.CANCELED },
    });

    // Best-effort cancel of the BG job — idempotent, safe if already terminal.
    if (existing.jobId) {
      try {
        await this.jobs.cancel(companyId, existing.jobId);
      } catch {
        // Ignore — job may already have terminated; handler will see CANCELED status.
      }
    }

    void this.audit(companyId, actorId, AuditAction.UPDATE, id, {
      oldValues: { status: existing.status },
      newValues: { status: ScheduledMessageStatus.CANCELED },
    });
    return updated;
  }

  // ===== Handler ================================================

  /**
   * BackgroundJob handler — invoked by the worker tick at scheduledAt.
   * Must be resilient to CANCELED race and transient WhatsApp failures.
   */
  async handleSend(job: BackgroundJob): Promise<{ sent: boolean; reason?: string }> {
    const payload = (job.payload ?? {}) as { messageId?: string };
    const messageId = payload.messageId;
    if (!messageId) {
      return { sent: false, reason: 'missing_messageId' };
    }

    const message = await this.prisma.scheduledMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      return { sent: false, reason: 'message_not_found' };
    }
    if (message.status !== ScheduledMessageStatus.PENDING) {
      // Race: user canceled after job started. Swallow silently.
      return { sent: false, reason: `status_${message.status.toLowerCase()}` };
    }

    try {
      await this.whatsapp.sendMessage(message.chatId, message.companyId, {
        content: message.content,
        ...(message.mediaUrl ? { type: 'IMAGE' } : {}),
      });
      await this.prisma.scheduledMessage.update({
        where: { id: messageId },
        data: {
          status: ScheduledMessageStatus.SENT,
          sentAt: new Date(),
          runCount: { increment: 1 },
          lastError: null,
        },
      });
      return { sent: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.prisma.scheduledMessage.update({
        where: { id: messageId },
        data: {
          status: ScheduledMessageStatus.FAILED,
          runCount: { increment: 1 },
          lastError: msg.slice(0, 500),
        },
      });
      // Re-throw so BG job records the failure and respects maxAttempts.
      throw err;
    }
  }

  // ===== UTIL ===================================================

  private async audit(
    companyId: string,
    userId: string | null,
    action: AuditAction,
    resourceId: string,
    values: { oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          resource: 'SCHEDULED_MESSAGE',
          resourceId,
          oldValues: (values.oldValues ?? {}) as unknown as Prisma.InputJsonValue,
          newValues: (values.newValues ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`audit failed for scheduled_message=${resourceId}: ${String(err)}`);
    }
  }

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }
}
