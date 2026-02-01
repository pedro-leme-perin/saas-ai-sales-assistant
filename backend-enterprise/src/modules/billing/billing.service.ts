// =============================================
// 💳 BILLING SERVICE
// =============================================
// Stripe integration for subscriptions
// Implements: Clean Architecture Service Layer
// Resilience: Error handling + Circuit breaker ready
// References: Clean Architecture Ch.22, Release It! Ch.4
// =============================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { AuthenticatedUser } from '@common/decorators';
import { Plan, SubscriptionStatus, AuditAction } from '@prisma/client';

// =============================================
// TYPES & INTERFACES
// =============================================

/**
 * Plan details returned to frontend
 * Separates domain model (Plan enum) from presentation (PlanDetails)
 * Clean Architecture: Dependency Rule - domain independent
 */
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

/**
 * Stripe subscription data from webhooks
 * Type-safe external API contract
 */
interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  metadata?: {
    companyId?: string;
  };
  items: {
    data: Array<{
      price: {
        id: string;
      };
    }>;
  };
}

// =============================================
// BILLING SERVICE
// =============================================

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripeSecretKey: string;
  private readonly stripePrices: Record<Plan, string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Configuration loaded at startup
    // Release It!: Fail fast if misconfigured
    this.stripeSecretKey = this.configService.get<string>('stripe.secretKey') || '';
    this.stripePrices = {
      [Plan.STARTER]: this.configService.get<string>('stripe.prices.starter') || '',
      [Plan.PROFESSIONAL]: this.configService.get<string>('stripe.prices.professional') || '',
      [Plan.ENTERPRISE]: this.configService.get<string>('stripe.prices.enterprise') || '',
    };

    if (!this.stripeSecretKey) {
      this.logger.warn('⚠️  Stripe not configured - running in development mode');
    }
  }

  // =============================================
  // GET AVAILABLE PLANS
  // =============================================
  /**
   * Returns all available subscription plans
   * Pure function - no side effects (Clean Code principle)
   * This is static business logic, not database-driven yet
   */
  getPlans(): PlanDetails[] {
    return [
      {
        name: 'Starter',
        plan: Plan.STARTER,
        price: 149,
        currency: 'BRL',
        features: [
          'Até 5 usuários',
          '100 ligações/mês',
          '50 chats WhatsApp/mês',
          'Sugestões de IA básicas',
          'Relatórios básicos',
          'Suporte por email',
        ],
        limits: { users: 5, callsPerMonth: 100, chatsPerMonth: 50 },
      },
      {
        name: 'Professional',
        plan: Plan.PROFESSIONAL,
        price: 299,
        currency: 'BRL',
        features: [
          'Até 20 usuários',
          '500 ligações/mês',
          '200 chats WhatsApp/mês',
          'Sugestões de IA avançadas',
          'Relatórios completos',
          'Integrações com CRM',
          'Suporte prioritário',
        ],
        limits: { users: 20, callsPerMonth: 500, chatsPerMonth: 200 },
      },
      {
        name: 'Enterprise',
        plan: Plan.ENTERPRISE,
        price: 499,
        currency: 'BRL',
        features: [
          'Usuários ilimitados',
          'Ligações ilimitadas',
          'Chats WhatsApp ilimitados',
          'IA personalizada',
          'API completa',
          'White-label',
          'Gerente de conta dedicado',
          'Suporte 24/7',
        ],
        limits: { users: 1000, callsPerMonth: 10000, chatsPerMonth: 5000 },
      },
    ];
  }

  // =============================================
  // GET SUBSCRIPTION
  // =============================================
  /**
   * Get current subscription details for a company
   * Combines data from subscription + company for complete view
   * 
   * @throws NotFoundException if company doesn't exist
   */
  async getSubscription(companyId: string) {
    try {
      // Parallel queries for performance (when both needed)
      const [subscription, company] = await Promise.all([
        this.prisma.subscription.findFirst({
          where: {
            companyId,
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
          },
          include: {
            company: { select: { id: true, name: true, plan: true } },
          },
        }),
        this.prisma.company.findUnique({
          where: { id: companyId },
          select: { plan: true, maxUsers: true, maxCallsPerMonth: true, maxChatsPerMonth: true },
        }),
      ]);

      if (!company) {
        throw new NotFoundException(`Company ${companyId} not found`);
      }

      const plans = this.getPlans();
      const currentPlan = plans.find((p) => p.plan === company.plan);

      return {
        subscription,
        plan: currentPlan,
        company: {
          plan: company.plan,
          limits: {
            users: company.maxUsers,
            callsPerMonth: company.maxCallsPerMonth,
            chatsPerMonth: company.maxChatsPerMonth,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get subscription for company ${companyId}:`, error);
      throw error;
    }
  }

  // =============================================
  // GET INVOICES
  // =============================================
  /**
   * Get invoice history for a company
   * Limited to last 24 months for performance
   */
  async getInvoices(companyId: string) {
    try {
      return await this.prisma.invoice.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 24, // Last 2 years
      });
    } catch (error) {
      this.logger.error(`Failed to get invoices for company ${companyId}:`, error);
      throw error;
    }
  }

  // =============================================
  // CREATE CHECKOUT SESSION
  // =============================================
  /**
   * Create Stripe checkout session for plan purchase
   * Graceful degradation: returns mock URL in dev mode
   * Release It!: Fail gracefully when Stripe unavailable
   * 
   * @throws NotFoundException if company doesn't exist
   * @throws BadRequestException if plan is invalid or Stripe fails
   */
  async createCheckoutSession(plan: Plan, companyId: string, user: AuthenticatedUser) {
    try {
      // Validate company exists
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      // Validate plan
      const priceId = this.stripePrices[plan];
      if (!priceId) {
        throw new BadRequestException(`Invalid plan: ${plan}`);
      }

      // Production mode - integrate with Stripe
      if (this.isStripeConfigured()) {
        try {
          // TODO: Uncomment when Stripe is ready
          // const stripe = new Stripe(this.stripeSecretKey, { apiVersion: '2023-10-16' });
          // const session = await stripe.checkout.sessions.create({
          //   customer: company.stripeCustomerId,
          //   mode: 'subscription',
          //   payment_method_types: ['card'],
          //   line_items: [{ price: priceId, quantity: 1 }],
          //   success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          //   cancel_url: `${process.env.FRONTEND_URL}/billing/cancelled`,
          //   metadata: { companyId, userId: user.id, plan },
          // });
          // 
          // this.logger.log(`Checkout session created for company ${companyId}, plan ${plan}`);
          // return { url: session.url };
          
          // For now, return mock
          throw new Error('Stripe not implemented yet');
        } catch (error) {
          this.logger.error('Stripe checkout creation failed:', error);
          throw new BadRequestException('Payment provider error. Please try again later.');
        }
      }

      // Development mode - mock response
      this.logger.warn('⚠️  Stripe not configured, returning mock checkout URL');
      return {
        url: `http://localhost:3000/checkout/mock?plan=${plan}&company=${companyId}`,
        message: 'Development mode - Stripe not configured',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Unexpected error creating checkout for company ${companyId}:`, error);
      throw new BadRequestException('Failed to create checkout session');
    }
  }

  // =============================================
  // CHANGE PLAN
  // =============================================
  /**
   * Change company's subscription plan
   * Transactional: updates company + creates audit log atomically
   * Clean Architecture: Business logic in service layer
   * 
   * @throws NotFoundException if company doesn't exist
   * @throws BadRequestException if plan is invalid or same as current
   */
  async changePlan(newPlan: Plan, companyId: string, user: AuthenticatedUser) {
    try {
      // Validate company exists
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const oldPlan = company.plan;

      // Validate plan change is meaningful
      if (oldPlan === newPlan) {
        throw new BadRequestException('Already on this plan');
      }

      // Get new plan details
      const plans = this.getPlans();
      const planDetails = plans.find((p) => p.plan === newPlan);
      if (!planDetails) {
        throw new BadRequestException(`Invalid plan: ${newPlan}`);
      }

      // Transaction: update company + audit log (ACID properties)
      // Designing Data-Intensive Applications: Transactional guarantees
      await this.prisma.$transaction(async (tx) => {
        // Update company plan and limits
        await tx.company.update({
          where: { id: companyId },
          data: {
            plan: newPlan,
            maxUsers: planDetails.limits.users,
            maxCallsPerMonth: planDetails.limits.callsPerMonth,
            maxChatsPerMonth: planDetails.limits.chatsPerMonth,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            companyId,
            userId: user.id,
            action: AuditAction.UPDATE,
            resource: 'subscription',
            resourceId: companyId,
            description: `Plan changed from ${oldPlan} to ${newPlan}`,
            oldValues: { plan: oldPlan } as any,
            newValues: { plan: newPlan } as any,
          },
        });
      });

      this.logger.log(`✅ Company ${companyId} changed plan: ${oldPlan} → ${newPlan}`);

      return {
        success: true,
        message: `Plan changed to ${newPlan}`,
        plan: planDetails,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to change plan for company ${companyId}:`, error);
      throw new BadRequestException('Failed to change plan');
    }
  }

  // =============================================
  // CANCEL SUBSCRIPTION
  // =============================================
  /**
   * Cancel active subscription
   * Soft cancel: marks for cancellation at period end (user-friendly)
   * 
   * @throws NotFoundException if no active subscription found
   */
  async cancelSubscription(companyId: string, user: AuthenticatedUser) {
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: { companyId, status: SubscriptionStatus.ACTIVE },
      });

      if (!subscription) {
        throw new NotFoundException('No active subscription found');
      }

      // Transaction: update subscription + audit log
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            cancelAtPeriodEnd: true,
            canceledAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId: user.id,
            action: AuditAction.UPDATE,
            resource: 'subscription',
            resourceId: subscription.id,
            description: 'Subscription cancelled',
          },
        });
      });

      this.logger.log(`❌ Subscription cancelled for company ${companyId}`);

      return {
        success: true,
        message: 'Subscription will be cancelled at the end of the billing period',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to cancel subscription for company ${companyId}:`, error);
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  // =============================================
  // GET CUSTOMER PORTAL URL
  // =============================================
  /**
   * Generate Stripe customer portal URL
   * Allows customers to manage their subscription directly
   * 
   * @throws NotFoundException if company doesn't exist
   * @throws BadRequestException if no Stripe customer ID
   */
  async getPortalUrl(companyId: string) {
    try {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      if (!company.stripeCustomerId) {
        throw new BadRequestException('No Stripe customer ID found');
      }

      // Production mode
      if (this.isStripeConfigured()) {
        try {
          // TODO: Uncomment when Stripe is ready
          // const stripe = new Stripe(this.stripeSecretKey, { apiVersion: '2023-10-16' });
          // const session = await stripe.billingPortal.sessions.create({
          //   customer: company.stripeCustomerId,
          //   return_url: `${process.env.FRONTEND_URL}/billing`,
          // });
          // return { url: session.url };
          
          throw new Error('Stripe not implemented yet');
        } catch (error) {
          this.logger.error('Stripe portal creation failed:', error);
          throw new BadRequestException('Payment provider error');
        }
      }

      // Development mode
      return {
        url: 'https://billing.stripe.com/p/login/test',
        message: 'Development mode - Stripe not configured',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to get portal URL for company ${companyId}:`, error);
      throw new BadRequestException('Failed to generate portal URL');
    }
  }

  // =============================================
  // WEBHOOK HANDLERS
  // =============================================
  /**
   * Handle Stripe webhook: subscription.created
   * Idempotent: safe to call multiple times (webhook best practice)
   */
  async handleSubscriptionCreated(stripeSubscription: StripeSubscription) {
    try {
      const companyId = stripeSubscription.metadata?.companyId;
      if (!companyId) {
        this.logger.warn('⚠️  No companyId in subscription metadata');
        return;
      }

      // Check if subscription already exists (idempotency)
      const existing = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: stripeSubscription.id },
      });

      if (existing) {
        this.logger.warn(`Subscription ${stripeSubscription.id} already exists, skipping`);
        return;
      }

      await this.prisma.subscription.create({
        data: {
          companyId,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: stripeSubscription.items.data[0]?.price.id,
          stripeCustomerId: stripeSubscription.customer,
          plan: this.mapStripePriceToPlan(stripeSubscription.items.data[0]?.price.id),
          status: this.mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        },
      });

      this.logger.log(`✅ Subscription created for company ${companyId}`);
    } catch (error) {
      this.logger.error('Failed to handle subscription.created webhook:', error);
      // Don't throw - webhook should return 200 even on error (retry later)
    }
  }

  /**
   * Handle Stripe webhook: subscription.updated
   * Updates subscription status and billing period
   */
  async handleSubscriptionUpdated(stripeSubscription: StripeSubscription) {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: stripeSubscription.id },
      });

      if (!subscription) {
        this.logger.warn(`⚠️  Subscription not found: ${stripeSubscription.id}`);
        return;
      }

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: this.mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : null,
        },
      });

      this.logger.log(`✅ Subscription updated: ${subscription.id}`);
    } catch (error) {
      this.logger.error('Failed to handle subscription.updated webhook:', error);
      // Don't throw - webhook should return 200
    }
  }

  // =============================================
  // PRIVATE HELPERS
  // =============================================

  /**
   * Check if Stripe is properly configured
   * Prevents production code from running in dev mode
   */
  private isStripeConfigured(): boolean {
    return !!(this.stripeSecretKey && !this.stripeSecretKey.startsWith('sk_test_xxx'));
  }

  /**
   * Map Stripe price ID to internal Plan enum
   * Defensive: returns STARTER as default fallback
   */
  private mapStripePriceToPlan(priceId: string): Plan {
    if (priceId === this.stripePrices[Plan.ENTERPRISE]) return Plan.ENTERPRISE;
    if (priceId === this.stripePrices[Plan.PROFESSIONAL]) return Plan.PROFESSIONAL;
    return Plan.STARTER;
  }

  /**
   * Map Stripe status to internal SubscriptionStatus enum
   * Defensive: returns INCOMPLETE as default fallback
   */
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const mapping: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      trialing: SubscriptionStatus.TRIALING,
      incomplete: SubscriptionStatus.INCOMPLETE,
    };
    return mapping[stripeStatus] || SubscriptionStatus.INCOMPLETE;
  }
}