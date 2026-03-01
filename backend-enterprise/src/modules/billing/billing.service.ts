// ==============================================
// 💳 BILLING SERVICE
// ==============================================
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AuthenticatedUser } from '@common/decorators';
import { Plan, SubscriptionStatus, AuditAction } from '@prisma/client';
import Stripe from 'stripe';

export interface PlanDetails {
  name: string;
  plan: Plan;
  price: number;
  currency: string;
  features: string[];
  limits: {
    users: number;
    callsPerMonth: number;
    chatsPerMonth: number;
  };
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  metadata?: { companyId?: string };
  items: { data: Array<{ price: { id: string } }> };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null = null;
  private readonly stripeSecretKey: string;
  private readonly stripePrices: Record<Plan, string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripeSecretKey = this.configService.get<string>('stripe.secretKey') || '';
    this.stripePrices = {
      [Plan.STARTER]: this.configService.get<string>('stripe.prices.starter') || '',
      [Plan.PROFESSIONAL]: this.configService.get<string>('stripe.prices.professional') || '',
      [Plan.ENTERPRISE]: this.configService.get<string>('stripe.prices.enterprise') || '',
    };

    if (this.isStripeConfigured()) {
      (this as any).stripe = new Stripe(this.stripeSecretKey, { apiVersion: '2025-02-24.acacia' });
      this.logger.log('✅ Stripe initialized');
    } else {
      this.logger.warn('⚠️  Stripe not configured - running in development mode');
    }
  }

  getPlans(): PlanDetails[] {
    return [
      {
        name: 'Starter',
        plan: Plan.STARTER,
        price: 149,
        currency: 'BRL',
        features: ['Ate 5 usuarios', '100 ligacoes/mes', '200 chats WhatsApp/mes', 'Sugestoes de IA basicas', 'Relatorios basicos', 'Suporte por email'],
        limits: { users: 5, callsPerMonth: 100, chatsPerMonth: 200 },
      },
      {
        name: 'Professional',
        plan: Plan.PROFESSIONAL,
        price: 349,
        currency: 'BRL',
        features: ['Ate 20 usuarios', '500 ligacoes/mes', '500 chats WhatsApp/mes', 'Sugestoes de IA avancadas', 'Relatorios completos', 'Integracoes com CRM', 'Suporte prioritario'],
        limits: { users: 20, callsPerMonth: 500, chatsPerMonth: 500 },
      },
      {
        name: 'Enterprise',
        plan: Plan.ENTERPRISE,
        price: 749,
        currency: 'BRL',
        features: ['Usuarios ilimitados', 'Ligacoes ilimitadas', 'Chats WhatsApp ilimitados', 'IA personalizada', 'API completa', 'White-label', 'Gerente de conta dedicado', 'Suporte 24/7'],
        limits: { users: 1000, callsPerMonth: 10000, chatsPerMonth: 10000 },
      },
    ];
  }

  async getSubscription(companyId: string) {
    try {
      const [subscription, company] = await Promise.all([
        this.prisma.subscription.findFirst({
          where: { companyId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
          include: { company: { select: { id: true, name: true, plan: true } } },
        }),
        this.prisma.company.findUnique({
          where: { id: companyId },
          select: { plan: true, maxUsers: true, maxCallsPerMonth: true, maxChatsPerMonth: true },
        }),
      ]);

      if (!company) throw new NotFoundException(`Company ${companyId} not found`);

      const plans = this.getPlans();
      const currentPlan = plans.find((p) => p.plan === company.plan);

      return {
        subscription,
        plan: currentPlan,
        company: {
          plan: company.plan,
          limits: { users: company.maxUsers, callsPerMonth: company.maxCallsPerMonth, chatsPerMonth: company.maxChatsPerMonth },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get subscription for company ${companyId}:`, error);
      throw error;
    }
  }

  async getInvoices(companyId: string) {
    try {
      return await this.prisma.invoice.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 24,
      });
    } catch (error) {
      this.logger.error(`Failed to get invoices for company ${companyId}:`, error);
      throw error;
    }
  }

  async createCheckoutSession(plan: Plan, companyId: string, user: AuthenticatedUser) {
    try {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundException('Company not found');

      const priceId = this.stripePrices[plan];
      if (!priceId) throw new BadRequestException(`Invalid plan: ${plan}`);

      if (this.stripe) {
        let stripeCustomerId = company.stripeCustomerId;
        if (!stripeCustomerId) {
          const customer = await this.stripe.customers.create({
            email: user.email,
            name: company.name,
            metadata: { companyId },
          });
          stripeCustomerId = customer.id;
          await this.prisma.company.update({ where: { id: companyId }, data: { stripeCustomerId } });
        }

        const session = await this.stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${process.env.FRONTEND_URL}/faturamento?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/faturamento?cancelled=true`,
          metadata: { companyId, userId: user.id, plan },
          subscription_data: { metadata: { companyId } },
        });

        this.logger.log(`✅ Checkout session created for company ${companyId}, plan ${plan}`);
        return { url: session.url };
      }

      this.logger.warn('⚠️  Stripe not configured, returning mock checkout URL');
      return { url: `http://localhost:3000/faturamento?mock=true&plan=${plan}`, message: 'Development mode - Stripe not configured' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Unexpected error creating checkout for company ${companyId}:`, error);
      throw new BadRequestException('Failed to create checkout session');
    }
  }

  async changePlan(newPlan: Plan, companyId: string, user: AuthenticatedUser) {
    try {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundException('Company not found');

      const oldPlan = company.plan;
      if (oldPlan === newPlan) throw new BadRequestException('Already on this plan');

      const plans = this.getPlans();
      const planDetails = plans.find((p) => p.plan === newPlan);
      if (!planDetails) throw new BadRequestException(`Invalid plan: ${newPlan}`);

      await this.prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: companyId },
          data: { plan: newPlan, maxUsers: planDetails.limits.users, maxCallsPerMonth: planDetails.limits.callsPerMonth, maxChatsPerMonth: planDetails.limits.chatsPerMonth },
        });
        await tx.auditLog.create({
          data: { companyId, userId: user.id, action: AuditAction.UPDATE, resource: 'subscription', resourceId: companyId, description: `Plan changed from ${oldPlan} to ${newPlan}`, oldValues: { plan: oldPlan } as any, newValues: { plan: newPlan } as any },
        });
      });

      this.logger.log(`✅ Company ${companyId} changed plan: ${oldPlan} => ${newPlan}`);
      return { success: true, message: `Plan changed to ${newPlan}`, plan: planDetails };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to change plan for company ${companyId}:`, error);
      throw new BadRequestException('Failed to change plan');
    }
  }

  async cancelSubscription(companyId: string, user: AuthenticatedUser) {
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: { companyId, status: SubscriptionStatus.ACTIVE },
      });
      if (!subscription) throw new NotFoundException('No active subscription found');

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true, canceledAt: new Date() } });
        await tx.auditLog.create({
          data: { companyId, userId: user.id, action: AuditAction.UPDATE, resource: 'subscription', resourceId: subscription.id, description: 'Subscription cancelled' },
        });
      });

      this.logger.log(`❌ Subscription cancelled for company ${companyId}`);
      return { success: true, message: 'Subscription will be cancelled at the end of the billing period', cancelAtPeriodEnd: true, currentPeriodEnd: subscription.currentPeriodEnd };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to cancel subscription for company ${companyId}:`, error);
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  async getPortalUrl(companyId: string) {
    try {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundException('Company not found');
      if (!company.stripeCustomerId) throw new BadRequestException('No Stripe customer ID found');

      if (this.stripe) {
        const session = await this.stripe.billingPortal.sessions.create({
          customer: company.stripeCustomerId,
          return_url: `${process.env.FRONTEND_URL}/faturamento`,
        });
        return { url: session.url };
      }

      return { url: 'https://billing.stripe.com/p/login/test', message: 'Development mode' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to get portal URL for company ${companyId}:`, error);
      throw new BadRequestException('Failed to generate portal URL');
    }
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret') || '';
    if (!this.stripe || !webhookSecret) {
      this.logger.warn('⚠️  Webhook received but Stripe not configured');
      return;
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed:', err);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`📨 Webhook received: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as any);
        break;
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as any);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  async handleSubscriptionCreated(stripeSub: StripeSubscription) {
    try {
      const companyId = stripeSub.metadata?.companyId;
      if (!companyId) { this.logger.warn('⚠️  No companyId in subscription metadata'); return; }

      const existing = await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId: stripeSub.id } });
      if (existing) { this.logger.warn(`Subscription ${stripeSub.id} already exists, skipping`); return; }

      const plan = this.mapStripePriceToPlan(stripeSub.items.data[0]?.price.id);
      const planDetails = this.getPlans().find((p) => p.plan === plan);

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.create({
          data: {
            companyId, stripeSubscriptionId: stripeSub.id, stripePriceId: stripeSub.items.data[0]?.price.id,
            stripeCustomerId: stripeSub.customer, plan, status: this.mapStripeStatus(stripeSub.status),
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
        });
        if (planDetails) {
          await tx.company.update({
            where: { id: companyId },
            data: { plan, stripeCustomerId: stripeSub.customer, maxUsers: planDetails.limits.users, maxCallsPerMonth: planDetails.limits.callsPerMonth, maxChatsPerMonth: planDetails.limits.chatsPerMonth },
          });
        }
      });

      this.logger.log(`✅ Subscription created for company ${companyId}`);
    } catch (error) {
      this.logger.error('Failed to handle subscription.created webhook:', error);
    }
  }

  async handleSubscriptionUpdated(stripeSub: StripeSubscription) {
    try {
      const subscription = await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId: stripeSub.id } });
      if (!subscription) { this.logger.warn(`⚠️  Subscription not found: ${stripeSub.id}`); return; }

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: this.mapStripeStatus(stripeSub.status),
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
        },
      });
      this.logger.log(`✅ Subscription updated: ${subscription.id}`);
    } catch (error) {
      this.logger.error('Failed to handle subscription.updated webhook:', error);
    }
  }

  async handleSubscriptionDeleted(stripeSub: StripeSubscription) {
    try {
      const subscription = await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId: stripeSub.id } });
      if (!subscription) return;

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({ where: { id: subscription.id }, data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() } });
        await tx.company.update({ where: { id: subscription.companyId }, data: { plan: Plan.STARTER, maxUsers: 5, maxCallsPerMonth: 100, maxChatsPerMonth: 200 } });
      });
      this.logger.log(`❌ Subscription deleted: ${subscription.id}`);
    } catch (error) {
      this.logger.error('Failed to handle subscription.deleted webhook:', error);
    }
  }

  async handleCheckoutCompleted(session: any) {
    try {
      this.logger.log(`✅ Checkout completed: ${session.id}`);
    } catch (error) {
      this.logger.error('Failed to handle checkout.session.completed webhook:', error);
    }
  }

  private isStripeConfigured(): boolean {
    return !!(this.stripeSecretKey && !this.stripeSecretKey.startsWith('sk_test_xxx'));
  }

  private mapStripePriceToPlan(priceId: string): Plan {
    if (priceId === this.stripePrices[Plan.ENTERPRISE]) return Plan.ENTERPRISE;
    if (priceId === this.stripePrices[Plan.PROFESSIONAL]) return Plan.PROFESSIONAL;
    return Plan.STARTER;
  }

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const mapping: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE, past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED, unpaid: SubscriptionStatus.UNPAID,
      trialing: SubscriptionStatus.TRIALING, incomplete: SubscriptionStatus.INCOMPLETE,
    };
    return mapping[stripeStatus] || SubscriptionStatus.INCOMPLETE;
  }
}
