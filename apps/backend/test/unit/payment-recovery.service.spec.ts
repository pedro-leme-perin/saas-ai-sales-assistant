// =============================================
// 💸 PaymentRecoveryService — unit tests (Session 42)
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentRecoveryService } from '../../src/modules/payment-recovery/payment-recovery.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';
import {
  computeNextDunningAt,
  graceDeadline,
  DUNNING_SCHEDULE,
} from '../../src/modules/payment-recovery/constants';
import type { AuthenticatedUser } from '../../src/common/decorators';

type TxCallback<T> = (tx: unknown) => Promise<T> | T;

jest.setTimeout(15000);

describe('PaymentRecoveryService', () => {
  let service: PaymentRecoveryService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'owner@acme.com',
    companyId: 'company-1',
    role: 'OWNER',
  } as unknown as AuthenticatedUser;

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEmailService = {
    sendDunningEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'stripe.secretKey') return '';
      return '';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRecoveryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentRecoveryService>(PaymentRecoveryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // Domain helpers
  // =============================================
  describe('domain helpers', () => {
    it('computeNextDunningAt returns null for SUSPENDED', () => {
      expect(computeNextDunningAt('SUSPENDED')).toBeNull();
    });

    it('computeNextDunningAt adds offsetHours for D1', () => {
      const from = new Date('2026-01-01T00:00:00Z');
      const next = computeNextDunningAt('D1', from)!;
      const diffH = (next.getTime() - from.getTime()) / (1000 * 60 * 60);
      expect(diffH).toBe(DUNNING_SCHEDULE.D1.offsetHours);
    });

    it('graceDeadline respects plan-specific days', () => {
      const failedAt = new Date('2026-01-01T00:00:00Z');
      const starter = graceDeadline('STARTER', failedAt);
      const enterprise = graceDeadline('ENTERPRISE', failedAt);
      expect(enterprise.getTime()).toBeGreaterThan(starter.getTime());
    });
  });

  // =============================================
  // scheduleDunning
  // =============================================
  describe('scheduleDunning', () => {
    it('warns and exits when invoice not found', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);
      await service.scheduleDunning('missing-inv');
      expect(mockPrismaService.invoice.update).not.toHaveBeenCalled();
    });

    it('skips dunning if invoice already PAID', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PAID',
        dunningStage: null,
        paymentAttempts: 0,
        lastPaymentError: null,
        nextDunningAt: null,
      });
      await service.scheduleDunning('inv-1');
      expect(mockPrismaService.invoice.update).not.toHaveBeenCalled();
    });

    it('increments attempts and sets D1 stage on first failure', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'OPEN',
        dunningStage: null,
        paymentAttempts: 0,
        lastPaymentError: null,
        nextDunningAt: null,
      });
      mockPrismaService.invoice.update.mockResolvedValue({});

      await service.scheduleDunning('inv-1', 'card_declined');

      expect(mockPrismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            paymentAttempts: { increment: 1 },
            dunningStage: 'D1',
            lastPaymentError: 'card_declined',
          }),
        }),
      );
    });

    it('preserves existing stage on subsequent calls', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'OPEN',
        dunningStage: 'D3',
        paymentAttempts: 2,
        lastPaymentError: 'prior',
        nextDunningAt: null,
      });
      mockPrismaService.invoice.update.mockResolvedValue({});

      await service.scheduleDunning('inv-1');

      expect(mockPrismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dunningStage: 'D3' }),
        }),
      );
    });

    it('truncates very long error messages to 500 chars', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'OPEN',
        dunningStage: null,
        paymentAttempts: 0,
        lastPaymentError: null,
        nextDunningAt: null,
      });
      mockPrismaService.invoice.update.mockResolvedValue({});
      const longError = 'x'.repeat(2000);

      await service.scheduleDunning('inv-1', longError);

      const call = mockPrismaService.invoice.update.mock.calls[0][0];
      expect(call.data.lastPaymentError.length).toBe(500);
    });
  });

  // =============================================
  // processDunning (cron)
  // =============================================
  describe('processDunning', () => {
    it('exits cleanly when batch is empty', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      await service.processDunning();
      expect(mockEmailService.sendDunningEmail).not.toHaveBeenCalled();
    });

    it('sends email and advances stage for D1 invoice', async () => {
      const invoice = {
        id: 'inv-1',
        companyId: 'company-1',
        amount: 29700,
        currency: 'brl',
        hostedInvoiceUrl: 'https://stripe.test/inv',
        createdAt: new Date('2026-01-01'),
        dunningStage: 'D1',
        status: 'OPEN',
        company: {
          id: 'company-1',
          plan: 'PROFESSIONAL',
          billingEmail: 'billing@acme.com',
          name: 'Acme',
        },
      };
      mockPrismaService.invoice.findMany.mockResolvedValue([invoice]);
      mockPrismaService.invoice.update.mockResolvedValue({});

      await service.processDunning();

      expect(mockEmailService.sendDunningEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'D1',
          recipientEmail: 'billing@acme.com',
          companyName: 'Acme',
        }),
      );
      expect(mockPrismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ dunningStage: 'D3' }),
        }),
      );
    });

    it('suspends company when transitioning from D7 to SUSPENDED', async () => {
      const invoice = {
        id: 'inv-2',
        companyId: 'company-1',
        amount: 29700,
        currency: 'brl',
        hostedInvoiceUrl: null,
        createdAt: new Date('2026-01-01'),
        dunningStage: 'D7',
        status: 'OPEN',
        company: {
          id: 'company-1',
          plan: 'STARTER',
          billingEmail: 'billing@acme.com',
          name: 'Acme',
        },
      };
      mockPrismaService.invoice.findMany.mockResolvedValue([invoice]);
      mockPrismaService.invoice.update.mockResolvedValue({});
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          company: { update: jest.fn() },
          subscription: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      await service.processDunning();

      expect(mockPrismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dunningStage: 'SUSPENDED', nextDunningAt: null }),
        }),
      );
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('isolates errors per invoice (one failure does not stop the batch)', async () => {
      const invA = {
        id: 'inv-a',
        companyId: 'company-1',
        amount: 1000,
        currency: 'brl',
        hostedInvoiceUrl: null,
        createdAt: new Date(),
        dunningStage: 'D1',
        status: 'OPEN',
        company: { id: 'company-1', plan: 'STARTER', billingEmail: 'a@a.com', name: 'A' },
      };
      const invB = {
        id: 'inv-b',
        companyId: 'company-2',
        amount: 2000,
        currency: 'brl',
        hostedInvoiceUrl: null,
        createdAt: new Date(),
        dunningStage: 'D1',
        status: 'OPEN',
        company: { id: 'company-2', plan: 'STARTER', billingEmail: 'b@b.com', name: 'B' },
      };
      mockPrismaService.invoice.findMany.mockResolvedValue([invA, invB]);
      mockEmailService.sendDunningEmail
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValueOnce(undefined);
      mockPrismaService.invoice.update.mockResolvedValue({});

      await service.processDunning();

      expect(mockEmailService.sendDunningEmail).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================
  // pauseSubscription
  // =============================================
  describe('pauseSubscription', () => {
    it('throws NotFoundException when no active subscription', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);
      await expect(service.pauseSubscription('company-1', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('marks subscription PAUSED with audit log', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        stripeSubscriptionId: null,
        currentPeriodEnd: new Date('2026-02-01'),
      });
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          subscription: { update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.pauseSubscription('company-1', mockUser, 'traveling');

      expect(result.success).toBe(true);
      expect(result.status).toBe('paused');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // =============================================
  // resumeSubscription
  // =============================================
  describe('resumeSubscription', () => {
    it('throws NotFoundException when no paused subscription', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);
      await expect(service.resumeSubscription('company-1', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('marks subscription ACTIVE with audit log', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        stripeSubscriptionId: null,
      });
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          subscription: { update: jest.fn() },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.resumeSubscription('company-1', mockUser);

      expect(result.success).toBe(true);
      expect(result.status).toBe('active');
    });
  });

  // =============================================
  // submitExitSurvey
  // =============================================
  describe('submitExitSurvey', () => {
    it('throws BadRequestException when no subscription', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);
      await expect(
        service.submitExitSurvey('company-1', mockUser, 'too_expensive'),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores reason and comment in cancelReason', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
      const updateFn = jest.fn();
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          subscription: { update: updateFn },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.submitExitSurvey(
        'company-1',
        mockUser,
        'missing_feature',
        'need analytics export',
      );

      expect(result.success).toBe(true);
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelReason: 'missing_feature: need analytics export',
          }),
        }),
      );
    });
  });

  // =============================================
  // getRecoveryStatus
  // =============================================
  describe('getRecoveryStatus', () => {
    it('throws NotFoundException when company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.subscription.findFirst.mockResolvedValue(null);

      await expect(service.getRecoveryStatus('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns hasFailedPayments=false when no open invoices', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({ plan: 'STARTER' });
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.subscription.findFirst.mockResolvedValue({ status: 'ACTIVE' });

      const result = await service.getRecoveryStatus('company-1');

      expect(result.hasFailedPayments).toBe(false);
      expect(result.openInvoices).toHaveLength(0);
    });

    it('flags inGracePeriod when deadline is in the future', async () => {
      const createdAt = new Date(); // just now → within grace
      mockPrismaService.company.findUnique.mockResolvedValue({ plan: 'STARTER' });
      mockPrismaService.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          amount: 9700,
          currency: 'brl',
          paymentAttempts: 1,
          dunningStage: 'D1',
          nextDunningAt: null,
          hostedInvoiceUrl: 'https://stripe.test/inv',
          createdAt,
        },
      ]);
      mockPrismaService.subscription.findFirst.mockResolvedValue({ status: 'PAST_DUE' });

      const result = await service.getRecoveryStatus('company-1');

      expect(result.hasFailedPayments).toBe(true);
      expect(result.inGracePeriod).toBe(true);
      expect(result.openInvoices[0].graceDeadline).toBeTruthy();
    });

    it('flags inGracePeriod=false when deadline expired', async () => {
      const createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      mockPrismaService.company.findUnique.mockResolvedValue({ plan: 'STARTER' });
      mockPrismaService.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          amount: 9700,
          currency: 'brl',
          paymentAttempts: 3,
          dunningStage: 'SUSPENDED',
          nextDunningAt: null,
          hostedInvoiceUrl: null,
          createdAt,
        },
      ]);
      mockPrismaService.subscription.findFirst.mockResolvedValue({ status: 'UNPAID' });

      const result = await service.getRecoveryStatus('company-1');

      expect(result.hasFailedPayments).toBe(true);
      expect(result.inGracePeriod).toBe(false);
    });
  });
});
