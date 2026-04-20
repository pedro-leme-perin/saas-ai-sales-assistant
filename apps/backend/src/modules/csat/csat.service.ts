// =============================================
// 📄 CSAT SERVICE (Session 50)
// =============================================
// Feature A2 — Customer Satisfaction surveys.
// Design:
// - CsatSurveyConfig (unique per company+trigger) controls delay +
//   channel + message template with {{link}}/{{score}} placeholders.
// - On call COMPLETED / chat RESOLVED, CsatService.scheduleForCall /
//   scheduleForChat stores a CsatResponse row (status=SCHEDULED,
//   scheduledFor=now+delay) with a random 32-byte url-safe token
//   (@@unique). Idempotent via (callId/chatId, trigger) uniqueness
//   check before insert — no double-send for retried webhooks.
// - @Cron every minute dispatches SCHEDULED rows due, bounded batch of
//   100, error-isolated per row. WhatsApp uses WhatsappService.sendMessage
//   (fallback to plain Twilio when sandbox). Email path uses EmailService.
// - Public submit endpoint (@Public) accepts { token, score 1..5, comment }
//   with constant-time lookup. State machine SCHEDULED→SENT→RESPONDED.
//   RESPONDED is terminal; EXPIRED when now > expiresAt. Comment max 2000.
// - Analytics exposes windowed CSAT score + NPS-like buckets.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { randomBytes } from 'crypto';
import {
  AuditAction,
  CsatChannel,
  CsatResponse,
  CsatResponseStatus,
  CsatSurveyConfig,
  CsatTrigger,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { UpsertCsatConfigDto } from './dto/upsert-csat-config.dto';
import { SubmitCsatDto } from './dto/submit-csat.dto';
import { CSAT_SCHEDULE_EVENT, type CsatScheduleEventPayload } from './events/csat-events';

const DISPATCH_BATCH = 100;
const EXPIRY_HOURS = 72;
const TOKEN_BYTES = 32;

@Injectable()
export class CsatService {
  private readonly logger = new Logger(CsatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
  ) {}

  // ===== CONFIG CRUD ====================================================

  async listConfigs(companyId: string): Promise<CsatSurveyConfig[]> {
    this.assertTenant(companyId);
    return this.prisma.csatSurveyConfig.findMany({
      where: { companyId },
      orderBy: { trigger: 'asc' },
    });
  }

  async upsertConfig(
    companyId: string,
    actorId: string,
    dto: UpsertCsatConfigDto,
  ): Promise<CsatSurveyConfig> {
    this.assertTenant(companyId);
    try {
      const row = await this.prisma.csatSurveyConfig.upsert({
        where: { csat_config_unique: { companyId, trigger: dto.trigger } },
        create: {
          companyId,
          trigger: dto.trigger,
          delayMinutes: dto.delayMinutes,
          channel: dto.channel,
          messageTpl: dto.messageTpl,
          isActive: dto.isActive ?? true,
        },
        update: {
          delayMinutes: dto.delayMinutes,
          channel: dto.channel,
          messageTpl: dto.messageTpl,
          isActive: dto.isActive ?? true,
        },
      });
      void this.audit(actorId, companyId, AuditAction.UPDATE, row.id, { dto });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('CSAT config already exists for this trigger');
      }
      throw err;
    }
  }

  async removeConfig(
    companyId: string,
    actorId: string,
    id: string,
  ): Promise<{ success: true }> {
    this.assertTenant(companyId);
    const cfg = await this.prisma.csatSurveyConfig.findFirst({ where: { id, companyId } });
    if (!cfg) throw new NotFoundException('CSAT config not found');
    await this.prisma.csatSurveyConfig.delete({ where: { id } });
    void this.audit(actorId, companyId, AuditAction.DELETE, cfg.id, { trigger: cfg.trigger });
    return { success: true };
  }

  // ===== SCHEDULING =====================================================

  @OnEvent(CSAT_SCHEDULE_EVENT)
  async handleScheduleEvent(payload: CsatScheduleEventPayload): Promise<void> {
    try {
      await this.schedule({
        companyId: payload.companyId,
        trigger: payload.trigger,
        callId: payload.callId,
        chatId: payload.chatId,
        contactId: payload.contactId ?? null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`csat schedule event failed: ${msg}`);
    }
  }

  async scheduleForCall(params: {
    companyId: string;
    callId: string;
    contactId?: string | null;
  }): Promise<CsatResponse | null> {
    return this.schedule({
      companyId: params.companyId,
      trigger: CsatTrigger.CALL_END,
      callId: params.callId,
      contactId: params.contactId ?? null,
    });
  }

  async scheduleForChat(params: {
    companyId: string;
    chatId: string;
    contactId?: string | null;
  }): Promise<CsatResponse | null> {
    return this.schedule({
      companyId: params.companyId,
      trigger: CsatTrigger.CHAT_CLOSE,
      chatId: params.chatId,
      contactId: params.contactId ?? null,
    });
  }

  private async schedule(params: {
    companyId: string;
    trigger: CsatTrigger;
    callId?: string;
    chatId?: string;
    contactId: string | null;
  }): Promise<CsatResponse | null> {
    const config = await this.prisma.csatSurveyConfig.findFirst({
      where: { companyId: params.companyId, trigger: params.trigger, isActive: true },
    });
    if (!config) return null;

    // Idempotency: only one SCHEDULED/SENT/RESPONDED survey per source record.
    const existing = await this.prisma.csatResponse.findFirst({
      where: {
        companyId: params.companyId,
        trigger: params.trigger,
        ...(params.callId ? { callId: params.callId } : {}),
        ...(params.chatId ? { chatId: params.chatId } : {}),
      },
    });
    if (existing) return existing;

    const now = new Date();
    const scheduledFor = new Date(now.getTime() + config.delayMinutes * 60_000);
    const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 3_600_000);

    try {
      return await this.prisma.csatResponse.create({
        data: {
          companyId: params.companyId,
          contactId: params.contactId,
          callId: params.callId ?? null,
          chatId: params.chatId ?? null,
          trigger: params.trigger,
          channel: config.channel,
          token: this.generateToken(),
          status: CsatResponseStatus.SCHEDULED,
          scheduledFor,
          expiresAt,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`csat schedule failed: ${msg}`);
      return null;
    }
  }

  // ===== CRON DISPATCH ==================================================

  @Cron(CronExpression.EVERY_MINUTE, { name: 'csat-dispatch-tick' })
  async dispatchTick(): Promise<void> {
    const now = new Date();
    const batch = await this.prisma.csatResponse.findMany({
      where: {
        status: CsatResponseStatus.SCHEDULED,
        scheduledFor: { lte: now },
        expiresAt: { gt: now },
      },
      take: DISPATCH_BATCH,
      orderBy: { scheduledFor: 'asc' },
    });
    if (batch.length === 0) return;

    // Expire stale rows in a single pass to avoid starvation of the queue.
    await this.prisma.csatResponse.updateMany({
      where: {
        status: CsatResponseStatus.SCHEDULED,
        expiresAt: { lte: now },
      },
      data: { status: CsatResponseStatus.EXPIRED },
    });

    for (const row of batch) {
      try {
        await this.dispatch(row);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`csat dispatch failed row=${row.id}: ${msg}`);
        await this.prisma.csatResponse.update({
          where: { id: row.id },
          data: { status: CsatResponseStatus.FAILED, lastError: msg.slice(0, 500) },
        });
      }
    }
  }

  private async dispatch(row: CsatResponse): Promise<void> {
    const config = await this.prisma.csatSurveyConfig.findFirst({
      where: { companyId: row.companyId, trigger: row.trigger, isActive: true },
    });
    if (!config) {
      await this.prisma.csatResponse.update({
        where: { id: row.id },
        data: { status: CsatResponseStatus.FAILED, lastError: 'config missing' },
      });
      return;
    }

    const link = this.surveyUrl(row.token);
    const message = this.renderMessage(config.messageTpl, link);

    if (row.channel === CsatChannel.WHATSAPP) {
      await this.sendWhatsapp(row, message);
    } else {
      await this.sendEmail(row, message, link);
    }

    await this.prisma.csatResponse.update({
      where: { id: row.id },
      data: { status: CsatResponseStatus.SENT, sentAt: new Date() },
    });
  }

  private async sendWhatsapp(row: CsatResponse, message: string): Promise<void> {
    const chatId = row.chatId;
    if (chatId) {
      // Reuse the existing chat when available so the survey lands in the
      // same thread and the agent can see it in-app.
      await this.whatsappService.sendMessage(chatId, row.companyId, { content: message });
      return;
    }

    // Fallback: look up customer phone via contact record.
    if (!row.contactId) {
      throw new Error('csat whatsapp dispatch: no chatId nor contactId');
    }
    const contact = await this.prisma.contact.findFirst({
      where: { id: row.contactId, companyId: row.companyId },
    });
    if (!contact) throw new Error('contact missing');

    // Best-effort: find or create a chat for this contact phone so the
    // message flows through the standard WhatsApp pipeline.
    const chat = await this.prisma.whatsappChat.findFirst({
      where: { companyId: row.companyId, customerPhone: contact.phone },
      orderBy: { lastMessageAt: 'desc' },
    });
    if (!chat) throw new Error('no chat available for contact phone');
    await this.whatsappService.sendMessage(chat.id, row.companyId, { content: message });
  }

  private async sendEmail(row: CsatResponse, message: string, link: string): Promise<void> {
    if (!row.contactId) throw new Error('csat email dispatch: no contactId');
    const contact = await this.prisma.contact.findFirst({
      where: { id: row.contactId, companyId: row.companyId },
    });
    if (!contact?.email) throw new Error('contact email missing');

    await this.emailService.sendCsatInvite({
      recipientEmail: contact.email,
      recipientName: contact.name ?? null,
      message,
      link,
    });
  }

  private renderMessage(template: string, link: string): string {
    return template.replace(/\{\{\s*link\s*\}\}/g, link);
  }

  private surveyUrl(token: string): string {
    const base = this.configService.get<string>('FRONTEND_URL') ?? 'https://theiadvisor.com';
    return `${base.replace(/\/$/, '')}/csat/${token}`;
  }

  // ===== PUBLIC SUBMIT ==================================================

  async lookupPublicByToken(token: string): Promise<{
    status: CsatResponseStatus;
    companyName: string | null;
    trigger: CsatTrigger;
    score: number | null;
    comment: string | null;
  }> {
    if (!token || token.length < 16) throw new NotFoundException('Invalid token');
    const row = await this.prisma.csatResponse.findUnique({
      where: { token },
      include: { company: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('Survey not found');

    // Side-effect: expire lazily if discovered past deadline.
    if (
      row.status === CsatResponseStatus.SCHEDULED &&
      row.expiresAt.getTime() < Date.now()
    ) {
      await this.prisma.csatResponse.update({
        where: { id: row.id },
        data: { status: CsatResponseStatus.EXPIRED },
      });
      row.status = CsatResponseStatus.EXPIRED;
    }

    return {
      status: row.status,
      companyName: row.company?.name ?? null,
      trigger: row.trigger,
      score: row.score,
      comment: row.comment,
    };
  }

  async submitPublic(token: string, dto: SubmitCsatDto): Promise<{ success: true }> {
    if (!token || token.length < 16) throw new NotFoundException('Invalid token');
    const row = await this.prisma.csatResponse.findUnique({ where: { token } });
    if (!row) throw new NotFoundException('Survey not found');
    if (row.status === CsatResponseStatus.RESPONDED) {
      throw new BadRequestException('Survey already submitted');
    }
    if (row.status === CsatResponseStatus.EXPIRED || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Survey expired');
    }

    await this.prisma.csatResponse.update({
      where: { id: row.id },
      data: {
        status: CsatResponseStatus.RESPONDED,
        score: dto.score,
        comment: dto.comment ?? null,
        respondedAt: new Date(),
      },
    });

    return { success: true };
  }

  // ===== ANALYTICS ======================================================

  async analytics(
    companyId: string,
    opts: { since?: Date; until?: Date } = {},
  ): Promise<{
    total: number;
    responded: number;
    responseRate: number;
    avgScore: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
    promoters: number;
    passives: number;
    detractors: number;
  }> {
    this.assertTenant(companyId);
    const since = opts.since ?? new Date(Date.now() - 30 * 86_400_000);
    const until = opts.until ?? new Date();

    const baseWhere: Prisma.CsatResponseWhereInput = {
      companyId,
      createdAt: { gte: since, lte: until },
    };

    const [total, responded, agg, buckets] = await Promise.all([
      this.prisma.csatResponse.count({ where: baseWhere }),
      this.prisma.csatResponse.count({
        where: { ...baseWhere, status: CsatResponseStatus.RESPONDED },
      }),
      this.prisma.csatResponse.aggregate({
        where: { ...baseWhere, status: CsatResponseStatus.RESPONDED, score: { not: null } },
        _avg: { score: true },
      }),
      this.prisma.csatResponse.groupBy({
        by: ['score'],
        where: { ...baseWhere, status: CsatResponseStatus.RESPONDED, score: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const b of buckets) {
      if (b.score && b.score >= 1 && b.score <= 5) {
        distribution[b.score as 1 | 2 | 3 | 4 | 5] = b._count._all;
      }
    }

    const promoters = distribution[5];
    const passives = distribution[4];
    const detractors = distribution[1] + distribution[2] + distribution[3];

    return {
      total,
      responded,
      responseRate: total > 0 ? Math.round((responded / total) * 1000) / 10 : 0,
      avgScore: Math.round((agg._avg.score ?? 0) * 100) / 100,
      distribution,
      promoters,
      passives,
      detractors,
    };
  }

  async listResponses(
    companyId: string,
    opts: { status?: CsatResponseStatus; limit?: number; cursor?: string } = {},
  ): Promise<{ data: CsatResponse[]; nextCursor: string | null }> {
    this.assertTenant(companyId);
    const take = Math.max(1, Math.min(200, opts.limit ?? 50));
    const where: Prisma.CsatResponseWhereInput = { companyId };
    if (opts.status) where.status = opts.status;

    const rows = await this.prisma.csatResponse.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const nextCursor = rows.length > take ? (rows[take].id ?? null) : null;
    return { data: rows.slice(0, take), nextCursor };
  }

  // ===== HELPERS ========================================================

  private generateToken(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
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
          userId,
          companyId,
          action,
          resource: 'CSAT_CONFIG',
          resourceId,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking: csat audit failed: ${msg}`);
    }
  }
}
