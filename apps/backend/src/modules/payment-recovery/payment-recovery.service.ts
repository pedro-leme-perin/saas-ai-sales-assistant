// =============================================
// 💸 PAYMENT RECOVERY SERVICE
// =============================================
// Session 42: Dunning + Billing recovery.
//
// Responsibilities:
//  1. Dunning email sequence (D+1, D+3, D+7) via cron
//  2. Self-service pause/resume via Stripe pause_collection
//  3. Exit survey capture
//  4. Grace period enforcement
//
// References:
//  - Release It! — Stability Patterns (Timeouts, Circuit Breaker)
//  - SRE — Release Engineering (feature flags, gradual rollout)
//  - Stripe Billing — pause_collection API
// =============================================

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { EmailService } from '@modules/email/email.service';
import { CircuitBreaker } from '@common/resilience/circuit-breaker';
import { promiseAllWithTimeout } from '@common/resilience/promise-timeout';
import {
  AuditAction,
  InvoiceStatus,
  Plan,
  Prisma,
  SubscriptionStatus,
  type Invoice,
} from '@prisma/client';
import Stripe from 'stripe';
import type { AuthenticatedUser } from '@common/decorators';
import {
  DUNNING_SCHEDULE,
  computeNextDunningAt,
  graceDeadline,
  type DunningStage,
  type ExitSurveyReason,
} from './constants';

@Injectable()
export class PaymentRecoveryService {
  private readonly logger = new Logger(PaymentRecoveryService.name);
  private stripe: Stripe | null = null;
  private readonly stripeBreaker: CircuitBreaker;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    if (secretKey && !secretKey.startsWith('sk_test_xxx')) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
    }

    this.stripeBreaker = new CircuitBreaker({
      name: 'Stripe-Recovery',
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      callTimeoutMs: 15_000,
    });
  }

  // =============================================
  // DUNNING — entrypoint called by BillingService
  // =============================================
  /**
   * Called by billing.handleInvoicePaymentFailed to enroll an invoice in
   * the dunning sequence. Idempotent: calling twice on the same invoice is safe.
   */
  async scheduleDunning(invoiceId: string, errorMessage?: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      this.logger.warn(`scheduleDunning: invoice ${invoiceId} not found`);
      return;
    }
    if (invoice.status === InvoiceStatus.PAID) {
      this.logger.log(`Invoice ${invoiceId} already PAID — skipping dunning`);
      return;
    }
    // If already in dunning sequence, just bump attempts.
    const nextStage: DunningStage = invoice.dunningStage
      ? (invoice.dunningStage as DunningStage)
      : 'D1';
    const nextAt = computeNextDunningAt(nextStage);

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentAttempts: { increment: 1 },
        lastPaymentError: errorMessage?.slice(0, 500) ?? invoice.lastPaymentError,
        dunningStage: invoice.dunningStage ?? 'D1',
        nextDunningAt: nextAt ?? invoice.nextDunningAt,
      },
    });

    this.logger.warn(
      `💸 Dunning scheduled for invoice ${invoiceId} (stage=${nextStage}, nextAt=${nextAt?.toISOString() ?? 'n/a'})`,
    );
  }

  // =============================================
  // CRON — process scheduled dunning events
  // =============================================
  /**
   * Runs every 10 minutes. Picks up invoices whose nextDunningAt ≤ now
   * and progresses them through the dunning stages (sends email, schedules next).
   *
   * SRE Four Golden Signals: errors logged via Sentry via GlobalExceptionFilter.
   * Release It!: bounded batch size prevents resource exhaustion.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'dunning-processor' })
  async processDunning(): Promise<void> {
    const now = new Date();
    let batch: Array<
      Invoice & { company: { id: string; plan: Plan; billingEmail: string | null; name: string } }
    >;
    try {
      batch = await this.prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.OPEN,
          nextDunningAt: { lte: now },
          dunningStage: { in: ['D1', 'D3', 'D7'] },
        },
        include: {
          company: {
            select: { id: true, plan: true, billingEmail: true, name: true },
          },
        },
        take: 100, // bounded batch — Release It! bulkhead
      });
    } catch (error) {
      this.logger.error('Failed to query dunning batch', error as Error);
      return;
    }

    if (batch.length === 0) return;

    this.logger.log(`🔁 Processing ${batch.length} dunning event(s)`);

    for (const invoice of batch) {
      try {
        await this.processSingleDunning(invoice);
      } catch (error) {
        this.logger.error(
          `Failed to process dunning for invoice ${invoice.id}: ${(error as Error).message}`,
          error as Error,
        );
      }
    }
  }

  private async processSingleDunning(
    invoice: Invoice & {
      company: { id: string; plan: Plan; billingEmail: string | null; name: string };
    },
  ): Promise<void> {
    const stage = invoice.dunningStage as DunningStage;
    const recipient = invoice.company.billingEmail;

    // Send dunning email for current stage (only D1/D3/D7 emit email).
    if (recipient && (stage === 'D1' || stage === 'D3' || stage === 'D7')) {
      await this.email.sendDunningEmail({
        stage,
        recipientEmail: recipient,
        companyName: invoice.company.name,
        amount: invoice.amount,
        currency: invoice.currency,
        hostedInvoiceUrl: invoice.hostedInvoiceUrl,
        graceDeadline: graceDeadline(invoice.company.plan, invoice.createdAt),
      });
    }

    // Advance to next stage.
    const schedule =
      stage in DUNNING_SCHEDULE ? DUNNING_SCHEDULE[stage as 'D1' | 'D3' | 'D7'] : null;
    const nextStage = schedule?.nextStage ?? 'SUSPENDED';
    const nextAt = nextStage === 'SUSPENDED' ? null : computeNextDunningAt(nextStage);

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { dunningStage: nextStage, nextDunningAt: nextAt },
    });

    if (nextStage === 'SUSPENDED') {
      await this.suspendCompany(invoice.company.id, invoice.id);
    }
  }

  private async suspendCompany(companyId: string, invoiceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { isActive: false },
      });
      // Park subscription in UNPAID (not deleted) — can still be recovered by paying.
      const sub = await tx.subscription.findFirst({ where: { companyId } });
      if (sub) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.UNPAID },
        });
      }
      await tx.auditLog.create({
        data: {
          companyId,
          action: AuditAction.UPDATE,
          resource: 'company',
          resourceId: companyId,
          description: `Company suspended after dunning sequence (invoice ${invoiceId})`,
        },
      });
    });
    this.logger.error(`🚨 Company ${companyId} SUSPENDED after dunning escalation`);
  }

  // =============================================
  // SELF-SERVICE — pause subscription
  // =============================================
  async pauseSubscription(
    companyId: string,
    user: AuthenticatedUser,
    reason?: string,
  ): Promise<{ success: boolean; status: string; resumableAt: string | null }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: SubscriptionStatus.ACTIVE },
    });
    if (!subscription) throw new NotFoundException('No active subscription to pause');

    if (this.stripe && subscription.stripeSubscriptionId) {
      await this.stripeBreaker.execute(async () => {
        await this.stripe!.subscriptions.update(subscription.stripeSubscriptionId, {
          pause_collection: { behavior: 'mark_uncollectible' },
          metadata: { pauseRequestedBy: user.id, pauseReason: reason ?? 'user_request' },
        });
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.PAUSED, cancelReason: reason ?? null },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId: user.id,
          action: AuditAction.UPDATE,
          resource: 'subscription',
          resourceId: subscription.id,
          description: `Subscription paused by user${reason ? ` — ${reason}` : ''}`,
        },
      });
    });

    this.logger.log(`⏸️  Subscription ${subscription.id} paused for company ${companyId}`);
    return {
      success: true,
      status: 'paused',
      resumableAt: subscription.currentPeriodEnd.toISOString(),
    };
  }

  // =============================================
  // SELF-SERVICE — resume subscription
  // =============================================
  async resumeSubscription(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<{ success: boolean; status: string }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: SubscriptionStatus.PAUSED },
    });
    if (!subscription) throw new NotFoundException('No paused subscription found');

    if (this.stripe && subscription.stripeSubscriptionId) {
      await this.stripeBreaker.execute(async () => {
        await this.stripe!.subscriptions.update(subscription.stripeSubscriptionId, {
          pause_collection: '' as unknown as null,
          // Passing empty string resets pause_collection per Stripe docs.
        });
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.ACTIVE, cancelReason: null },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId: user.id,
          action: AuditAction.UPDATE,
          resource: 'subscription',
          resourceId: subscription.id,
          description: 'Subscription resumed by user',
        },
      });
    });

    this.logger.log(`▶️  Subscription ${subscription.id} resumed for company ${companyId}`);
    return { success: true, status: 'active' };
  }

  // =============================================
  // SELF-SERVICE — exit survey
  // =============================================
  async submitExitSurvey(
    companyId: string,
    user: AuthenticatedUser,
    reason: ExitSurveyReason,
    comment?: string,
  ): Promise<{ success: boolean }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) throw new BadRequestException('No subscription found for this company');

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelReason: comment ? `${reason}: ${comment}` : reason,
        },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId: user.id,
          action: AuditAction.UPDATE,
          resource: 'subscription',
          resourceId: subscription.id,
          description: `Exit survey submitted: ${reason}`,
          newValues: { reason, comment } as Prisma.InputJsonValue,
        },
      });
    });

    this.logger.log(`📋 Exit survey captured for company ${companyId}: ${reason}`);
    return { success: true };
  }

  // =============================================
  // STATUS — recovery state for UI
  // =============================================
  async getRecoveryStatus(companyId: string): Promise<{
    hasFailedPayments: boolean;
    openInvoices: Array<{
      id: string;
      amount: number;
      currency: string;
      paymentAttempts: number;
      dunningStage: string | null;
      nextDunningAt: string | null;
      hostedInvoiceUrl: string | null;
      graceDeadline: string | null;
    }>;
    inGracePeriod: boolean;
    subscriptionStatus: string | null;
  }> {
    const [company, openInvoices, subscription] = await promiseAllWithTimeout(
      [
        this.prisma.company.findUnique({
          where: { id: companyId },
          select: { plan: true },
        }),
        this.prisma.invoice.findMany({
          where: { companyId, status: InvoiceStatus.OPEN },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.subscription.findFirst({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          select: { status: true },
        }),
      ],
      10_000,
      'getRecoveryStatus',
    );

    if (!company) throw new NotFoundException('Company not found');

    const now = new Date();
    let inGracePeriod = false;
    const invoiceSummaries = openInvoices.map((inv) => {
      const deadline = graceDeadline(company.plan, inv.createdAt);
      if (now < deadline) inGracePeriod = true;
      return {
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        paymentAttempts: inv.paymentAttempts,
        dunningStage: inv.dunningStage,
        nextDunningAt: inv.nextDunningAt?.toISOString() ?? null,
        hostedInvoiceUrl: inv.hostedInvoiceUrl,
        graceDeadline: deadline.toISOString(),
      };
    });

    return {
      hasFailedPayments: openInvoices.length > 0,
      openInvoices: invoiceSummaries,
      inGracePeriod,
      subscriptionStatus: subscription?.status ?? null,
    };
  }
}
