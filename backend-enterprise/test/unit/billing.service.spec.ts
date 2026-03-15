import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../../src/modules/billing/billing.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(15000);

describe('BillingService', () => {
  let service: BillingService;

  const mockCompany = {
    id: 'company-123',
    name: 'Acme Corp',
    plan: 'STARTER',
    stripeCustomerId: 'cus_test123',
    billingEmail: 'billing@acme.com',
    maxUsers: 5,
    maxCallsPerMonth: 100,
    maxChatsPerMonth: 200,
  };

  const mockSubscription = {
    id: 'sub-db-123',
    companyId: 'company-123',
    stripeSubscriptionId: 'sub_stripe123',
    stripePriceId: 'price_starter',
    stripeCustomerId: 'cus_test123',
    plan: 'STARTER',
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    company: { id: 'company-123', name: 'Acme Corp', plan: 'STARTER' },
  };

  const mockInvoice = {
    id: 'inv-123',
    companyId: 'company-123',
    stripeInvoiceId: 'in_test123',
    stripeCustomerId: 'cus_test123',
    status: 'PAID',
    currency: 'brl',
    amount: 14900,
    amountPaid: 14900,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'stripe.secretKey': '',
        'stripe.webhookSecret': '',
        'stripe.prices.starter': 'price_starter',
        'stripe.prices.professional': 'price_professional',
        'stripe.prices.enterprise': 'price_enterprise',
      };
      return config[key] || '';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // getPlans
  // =============================================
  describe('getPlans', () => {
    it('should return 3 plans', () => {
      const plans = service.getPlans();
      expect(plans).toHaveLength(3);
    });

    it('should return plans in correct order (Starter, Professional, Enterprise)', () => {
      const plans = service.getPlans();
      expect(plans[0].plan).toBe('STARTER');
      expect(plans[1].plan).toBe('PROFESSIONAL');
      expect(plans[2].plan).toBe('ENTERPRISE');
    });

    it('should have BRL currency for all plans', () => {
      const plans = service.getPlans();
      plans.forEach((plan) => {
        expect(plan.currency).toBe('BRL');
      });
    });

    it('should have increasing prices', () => {
      const plans = service.getPlans();
      expect(plans[0].price).toBeLessThan(plans[1].price);
      expect(plans[1].price).toBeLessThan(plans[2].price);
    });

    it('should have increasing limits', () => {
      const plans = service.getPlans();
      expect(plans[0].limits.users).toBeLessThan(plans[1].limits.users);
      expect(plans[1].limits.callsPerMonth).toBeLessThan(plans[2].limits.callsPerMonth);
    });
  });

  // =============================================
  // getSubscription
  // =============================================
  describe('getSubscription', () => {
    it('should return subscription with plan details', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getSubscription('company-123');

      expect(result.subscription).toBeDefined();
      expect(result.plan).toBeDefined();
      expect(result.company.plan).toBe('STARTER');
    });

    it('should return null subscription when none exists', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getSubscription('company-123');

      expect(result.subscription).toBeNull();
      expect(result.company.plan).toBe('STARTER');
    });

    it('should throw NotFoundException when company not found', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.getSubscription('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================
  // getInvoices
  // =============================================
  describe('getInvoices', () => {
    it('should return invoices for company', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([mockInvoice]);

      const result = await service.getInvoices('company-123');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-123' }, take: 24 }),
      );
    });

    it('should return empty array when no invoices', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await service.getInvoices('company-123');

      expect(result).toHaveLength(0);
    });
  });

  // =============================================
  // createCheckoutSession
  // =============================================
  describe('createCheckoutSession', () => {
    const mockUser = { id: 'user-123', email: 'john@acme.com', companyId: 'company-123', role: 'ADMIN' };

    it('should throw NotFoundException when company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('STARTER' as any, 'invalid-id', mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return mock URL in dev mode (Stripe not configured)', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.createCheckoutSession('PROFESSIONAL' as any, 'company-123', mockUser as any);

      expect(result.url).toContain('mock=true');
      expect(result.url).toContain('plan=PROFESSIONAL');
    });
  });

  // =============================================
  // changePlan
  // =============================================
  describe('changePlan', () => {
    const mockUser = { id: 'user-123', email: 'john@acme.com', companyId: 'company-123', role: 'ADMIN' };

    it('should throw NotFoundException when company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(
        service.changePlan('PROFESSIONAL' as any, 'invalid-id', mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when same plan', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      await expect(
        service.changePlan('STARTER' as any, 'company-123', mockUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should change plan and create audit log', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          company: { update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.changePlan('PROFESSIONAL' as any, 'company-123', mockUser as any);

      expect(result.success).toBe(true);
      expect(result.plan?.plan).toBe('PROFESSIONAL');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // =============================================
  // cancelSubscription
  // =============================================
  describe('cancelSubscription', () => {
    const mockUser = { id: 'user-123', email: 'john@acme.com', companyId: 'company-123', role: 'OWNER' };

    it('should throw NotFoundException when no active subscription', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelSubscription('company-123', mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should cancel subscription and create audit log', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          subscription: { update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.cancelSubscription('company-123', mockUser as any);

      expect(result.success).toBe(true);
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // =============================================
  // getPortalUrl
  // =============================================
  describe('getPortalUrl', () => {
    it('should throw NotFoundException when company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.getPortalUrl('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no stripeCustomerId', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({ ...mockCompany, stripeCustomerId: null });

      await expect(service.getPortalUrl('company-123')).rejects.toThrow(BadRequestException);
    });

    it('should return dev portal URL when Stripe not configured', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getPortalUrl('company-123');

      expect(result.url).toBeDefined();
      expect(result.message).toBe('Development mode');
    });
  });

  // =============================================
  // handleWebhook (dev mode - Stripe not configured)
  // =============================================
  describe('handleWebhook', () => {
    it('should return early when Stripe not configured', async () => {
      await service.handleWebhook(Buffer.from('{}'), 'sig_test');
      // No error thrown = success
    });
  });

  // =============================================
  // handleSubscriptionCreated
  // =============================================
  describe('handleSubscriptionCreated', () => {
    const stripeSubPayload = {
      id: 'sub_new123',
      customer: 'cus_test123',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      cancel_at_period_end: false,
      canceled_at: null,
      metadata: { companyId: 'company-123' },
      items: { data: [{ price: { id: 'price_starter' } }] },
    };

    it('should skip when no companyId in metadata', async () => {
      await service.handleSubscriptionCreated({ ...stripeSubPayload, metadata: {} });

      expect(mockPrismaService.subscription.findUnique).not.toHaveBeenCalled();
    });

    it('should skip when subscription already exists', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);

      await service.handleSubscriptionCreated(stripeSubPayload);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should create subscription and update company', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          subscription: { create: jest.fn() },
          company: { update: jest.fn() },
        };
        return cb(tx);
      });

      await service.handleSubscriptionCreated(stripeSubPayload);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // =============================================
  // handleSubscriptionUpdated
  // =============================================
  describe('handleSubscriptionUpdated', () => {
    const stripeSubPayload = {
      id: 'sub_stripe123',
      status: 'past_due',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      cancel_at_period_end: false,
      canceled_at: null,
    };

    it('should skip when subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await service.handleSubscriptionUpdated(stripeSubPayload as any);

      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
    });

    it('should update subscription status', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.handleSubscriptionUpdated(stripeSubPayload as any);

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-db-123' },
          data: expect.objectContaining({ status: 'PAST_DUE' }),
        }),
      );
    });
  });

  // =============================================
  // handleSubscriptionDeleted
  // =============================================
  describe('handleSubscriptionDeleted', () => {
    it('should skip when subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await service.handleSubscriptionDeleted({ id: 'sub_unknown' } as any);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should cancel subscription and reset company to STARTER', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          subscription: { update: jest.fn() },
          company: { update: jest.fn() },
        };
        return cb(tx);
      });

      await service.handleSubscriptionDeleted({ id: 'sub_stripe123' } as any);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // =============================================
  // handleInvoicePaid
  // =============================================
  describe('handleInvoicePaid', () => {
    const invoicePayload = {
      id: 'in_test456',
      customer: 'cus_test123',
      metadata: { companyId: 'company-123' },
      amount_due: 14900,
      amount_paid: 14900,
      currency: 'brl',
      hosted_invoice_url: 'https://invoice.stripe.com/test',
      invoice_pdf: 'https://invoice.stripe.com/test.pdf',
      period_start: Math.floor(Date.now() / 1000),
      period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    };

    it('should skip when no companyId', async () => {
      await service.handleInvoicePaid({ ...invoicePayload, metadata: {} });

      expect(mockPrismaService.invoice.upsert).not.toHaveBeenCalled();
    });

    it('should upsert invoice with PAID status', async () => {
      mockPrismaService.invoice.upsert.mockResolvedValue({});

      await service.handleInvoicePaid(invoicePayload);

      expect(mockPrismaService.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeInvoiceId: 'in_test456' },
          create: expect.objectContaining({ status: 'PAID', amount: 14900 }),
          update: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });
  });

  // =============================================
  // handleInvoicePaymentFailed
  // =============================================
  describe('handleInvoicePaymentFailed', () => {
    const failedInvoice = {
      id: 'in_failed789',
      customer: 'cus_test123',
      metadata: { companyId: 'company-123' },
      subscription: 'sub_stripe123',
      amount_due: 34900,
      currency: 'brl',
      hosted_invoice_url: null,
      invoice_pdf: null,
      period_start: null,
      period_end: null,
    };

    it('should skip when no companyId', async () => {
      await service.handleInvoicePaymentFailed({ ...failedInvoice, metadata: {} });

      expect(mockPrismaService.invoice.upsert).not.toHaveBeenCalled();
    });

    it('should upsert invoice with OPEN status', async () => {
      mockPrismaService.invoice.upsert.mockResolvedValue({});
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);

      await service.handleInvoicePaymentFailed(failedInvoice);

      expect(mockPrismaService.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeInvoiceId: 'in_failed789' },
          create: expect.objectContaining({ status: 'OPEN', amountPaid: 0 }),
        }),
      );
    });

    it('should mark subscription as PAST_DUE on payment failure', async () => {
      mockPrismaService.invoice.upsert.mockResolvedValue({});
      mockPrismaService.subscription.findFirst.mockResolvedValue(mockSubscription);
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.handleInvoicePaymentFailed(failedInvoice);

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-db-123' },
          data: { status: 'PAST_DUE' },
        }),
      );
    });
  });
});
