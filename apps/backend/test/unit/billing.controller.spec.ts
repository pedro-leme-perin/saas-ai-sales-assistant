import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from '../../src/modules/billing/billing.controller';
import { BillingService } from '../../src/modules/billing/billing.service';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';

jest.setTimeout(15000);

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: jest.Mocked<Partial<BillingService>>;

  const mockPlans = [
    {
      name: 'Starter',
      price: 14900,
      currency: 'brl',
      interval: 'month',
      limits: { users: 5, calls: 100, chats: 200 },
    },
    {
      name: 'Professional',
      price: 29900,
      currency: 'brl',
      interval: 'month',
      limits: { users: 15, calls: 500, chats: 1000 },
    },
    {
      name: 'Enterprise',
      price: 59900,
      currency: 'brl',
      interval: 'month',
      limits: { users: 50, calls: 2000, chats: 5000 },
    },
  ];

  const mockSubscription = {
    id: 'sub-123',
    plan: 'STARTER',
    status: 'ACTIVE',
    currentPeriodEnd: new Date('2026-04-01'),
  };

  const mockInvoices = [
    { id: 'inv-1', amount: 14900, status: 'PAID', createdAt: new Date() },
    { id: 'inv-2', amount: 14900, status: 'PAID', createdAt: new Date() },
  ];

  const mockUser = {
    id: 'user-123',
    email: 'admin@acme.com',
    name: 'Admin',
    role: 'ADMIN',
    companyId: 'company-123',
    company: { id: 'company-123', name: 'Acme Corp', plan: 'STARTER' },
  };

  beforeEach(async () => {
    billingService = {
      getPlans: jest.fn().mockResolvedValue(mockPlans),
      getSubscription: jest.fn().mockResolvedValue(mockSubscription),
      getInvoices: jest.fn().mockResolvedValue(mockInvoices),
      createCheckoutSession: jest
        .fn()
        .mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
      changePlan: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Plan changed', plan: mockPlans[1] }),
      cancelSubscription: jest.fn().mockResolvedValue({ success: true, message: 'Cancelled' }),
      getPortalUrl: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' }),
      handleWebhook: jest.fn().mockResolvedValue({ received: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: billingService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BillingController>(BillingController);
  });

  // ─────────────────────────────────────────
  // GET /billing/plans
  // ─────────────────────────────────────────

  describe('getPlans', () => {
    it('should return available plans', async () => {
      const result = await controller.getPlans();
      expect(result).toEqual(mockPlans);
      expect(billingService.getPlans).toHaveBeenCalledTimes(1);
    });

    it('should return 3 plans', async () => {
      const result = await controller.getPlans();
      expect(result).toHaveLength(3);
    });
  });

  // ─────────────────────────────────────────
  // GET /billing/subscription
  // ─────────────────────────────────────────

  describe('getSubscription', () => {
    it('should return subscription for companyId', async () => {
      const result = await controller.getSubscription('company-123');
      expect(result).toEqual(mockSubscription);
      expect(billingService.getSubscription).toHaveBeenCalledWith('company-123');
    });

    it('should delegate to service without transformation', async () => {
      await controller.getSubscription('company-456');
      expect(billingService.getSubscription).toHaveBeenCalledWith('company-456');
    });
  });

  // ─────────────────────────────────────────
  // GET /billing/invoices
  // ─────────────────────────────────────────

  describe('getInvoices', () => {
    it('should return invoices for companyId', async () => {
      const result = await controller.getInvoices('company-123');
      expect(result).toEqual(mockInvoices);
      expect(billingService.getInvoices).toHaveBeenCalledWith('company-123');
    });

    it('should return empty array when no invoices', async () => {
      (billingService.getInvoices as jest.Mock).mockResolvedValueOnce([]);
      const result = await controller.getInvoices('company-new');
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────
  // POST /billing/checkout
  // ─────────────────────────────────────────

  describe('createCheckout', () => {
    it('should create checkout session and return URL', async () => {
      const dto = { plan: 'PROFESSIONAL' as unknown };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.createCheckout(dto, 'company-123', mockUser as any);
      expect(result).toEqual({ url: 'https://checkout.stripe.com/test' });
      expect(billingService.createCheckoutSession).toHaveBeenCalledWith(
        'PROFESSIONAL',
        'company-123',
        mockUser,
      );
    });

    it('should pass correct companyId from decorator', async () => {
      const dto = { plan: 'ENTERPRISE' as unknown };
      await controller.createCheckout(dto, 'company-999', mockUser as unknown as typeof mockUser);
      expect(billingService.createCheckoutSession).toHaveBeenCalledWith(
        'ENTERPRISE',
        'company-999',
        mockUser,
      );
    });
  });

  // ─────────────────────────────────────────
  // POST /billing/change-plan
  // ─────────────────────────────────────────

  describe('changePlan', () => {
    it('should change plan and return result', async () => {
      const dto = { plan: 'PROFESSIONAL' as unknown };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.changePlan(dto, 'company-123', mockUser as any);
      expect(result).toEqual({ success: true, message: 'Plan changed', plan: mockPlans[1] });
      expect(billingService.changePlan).toHaveBeenCalledWith(
        'PROFESSIONAL',
        'company-123',
        mockUser,
      );
    });
  });

  // ─────────────────────────────────────────
  // POST /billing/cancel
  // ─────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('should cancel subscription', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.cancelSubscription('company-123', mockUser as any);
      expect(result).toEqual({ success: true, message: 'Cancelled' });
      expect(billingService.cancelSubscription).toHaveBeenCalledWith('company-123', mockUser);
    });
  });

  // ─────────────────────────────────────────
  // GET /billing/portal
  // ─────────────────────────────────────────

  describe('getPortalUrl', () => {
    it('should return portal URL', async () => {
      const result = await controller.getPortalUrl('company-123');
      expect(result).toEqual({ url: 'https://billing.stripe.com/portal' });
      expect(billingService.getPortalUrl).toHaveBeenCalledWith('company-123');
    });
  });

  // ─────────────────────────────────────────
  // POST /billing/webhook
  // ─────────────────────────────────────────

  describe('handleWebhook', () => {
    it('should forward raw payload and signature to service', async () => {
      const payload = Buffer.from('webhook-payload');
      const signature = 'sig_test_123';
      const result = await controller.handleWebhook(payload, signature);
      expect(result).toEqual({ received: true });
      expect(billingService.handleWebhook).toHaveBeenCalledWith(payload, signature);
    });
  });
});
