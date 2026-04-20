// =============================================
// 📊 UsageQuotaAlertsListener (Session 55 — Feature A2)
// =============================================
// Handles `usage.threshold.crossed` events by fanning in-app notifications
// to OWNER/ADMIN and attempting an email notice. Fully non-blocking:
// exceptions are logged and swallowed so metering hot paths are never
// impacted by alert delivery issues.

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  NotificationChannel,
  NotificationType,
  Prisma,
  UsageMetric,
} from '@prisma/client';

import { PrismaService } from '@infrastructure/database/prisma.service';

import { EmailService } from '@modules/email/email.service';

import { USAGE_THRESHOLD_EVENT, type ThresholdCrossedPayload } from './usage-quotas.service';

const METRIC_LABELS: Record<UsageMetric, string> = {
  CALLS: 'ligações',
  WHATSAPP_MESSAGES: 'mensagens WhatsApp',
  AI_SUGGESTIONS: 'sugestões de IA',
  STORAGE_MB: 'armazenamento (MB)',
};

// Optional: let WebhooksService see these breaches via the shared event bus.
const WEBHOOK_EMIT_EVENT = 'webhooks.emit';

@Injectable()
export class UsageQuotaAlertsListener {
  private readonly logger = new Logger(UsageQuotaAlertsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(USAGE_THRESHOLD_EVENT)
  async handle(payload: ThresholdCrossedPayload): Promise<void> {
    try {
      await Promise.all([
        this.fanInApp(payload),
        this.sendAdminEmail(payload),
        this.emitWebhook(payload),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`usage threshold alert failed: ${msg}`);
    }
  }

  private async fanInApp(payload: ThresholdCrossedPayload): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          companyId: payload.companyId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { id: true },
        take: 10,
      });

      const metricLabel = METRIC_LABELS[payload.metric];
      for (const admin of admins) {
        await this.prisma.notification.create({
          data: {
            userId: admin.id,
            companyId: payload.companyId,
            type: NotificationType.BILLING_ALERT,
            channel: NotificationChannel.IN_APP,
            title: `Consumo em ${payload.threshold}% — ${metricLabel}`,
            message:
              `Você usou ${payload.used} de ${payload.limit} ${metricLabel} ` +
              `neste período de cobrança.`,
            data: {
              metric: payload.metric,
              threshold: payload.threshold,
              used: payload.used,
              limit: payload.limit,
            } as Prisma.InputJsonValue,
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`usage threshold in-app fan failed: ${msg}`);
    }
  }

  private async sendAdminEmail(payload: ThresholdCrossedPayload): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          companyId: payload.companyId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { email: true, firstName: true },
        take: 5,
      });
      const company = await this.prisma.company.findUnique({
        where: { id: payload.companyId },
        select: { name: true },
      });

      const metricLabel = METRIC_LABELS[payload.metric];
      for (const admin of admins) {
        if (!admin.email) continue;
        await this.emailService.sendUsageThresholdEmail({
          recipientEmail: admin.email,
          recipientName: admin.firstName ?? 'time',
          companyName: company?.name ?? '',
          metricLabel,
          threshold: payload.threshold,
          used: payload.used,
          limit: payload.limit,
          periodEnd: payload.periodEnd,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`usage threshold email failed: ${msg}`);
    }
  }

  private async emitWebhook(payload: ThresholdCrossedPayload): Promise<void> {
    try {
      this.eventEmitter.emit(WEBHOOK_EMIT_EVENT, {
        companyId: payload.companyId,
        event: 'USAGE_THRESHOLD',
        data: {
          metric: payload.metric,
          threshold: payload.threshold,
          used: payload.used,
          limit: payload.limit,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`usage threshold webhook emit failed: ${msg}`);
    }
  }
}
