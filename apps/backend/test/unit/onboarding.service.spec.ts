// =============================================
// 🚀 OnboardingService — unit tests (Session 42)
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OnboardingService } from '../../src/modules/onboarding/onboarding.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import {
  ONBOARDING_STEPS,
  computeProgressPercent,
  isOnboardingComplete,
  EMPTY_ONBOARDING_PROGRESS,
} from '../../src/modules/onboarding/constants';

type TxCallback<T> = (tx: unknown) => Promise<T> | T;

jest.setTimeout(15000);

describe('OnboardingService', () => {
  let service: OnboardingService;

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    call: {
      count: jest.fn(),
    },
    whatsappChat: {
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // constants — pure domain
  // =============================================
  describe('domain helpers', () => {
    it('computeProgressPercent returns 0 for empty state', () => {
      expect(computeProgressPercent(EMPTY_ONBOARDING_PROGRESS())).toBe(0);
    });

    it('computeProgressPercent counts skipped steps as progress', () => {
      const state = EMPTY_ONBOARDING_PROGRESS();
      state.stepsSkipped.push('COMPLETE_PROFILE');
      state.stepsCompleted.push('INVITE_TEAM');
      expect(computeProgressPercent(state)).toBe(Math.round((2 / 6) * 100));
    });

    it('isOnboardingComplete returns true when all steps done or skipped', () => {
      const state = EMPTY_ONBOARDING_PROGRESS();
      state.stepsCompleted.push(...ONBOARDING_STEPS);
      expect(isOnboardingComplete(state)).toBe(true);
    });

    it('isOnboardingComplete false when missing any step', () => {
      const state = EMPTY_ONBOARDING_PROGRESS();
      state.stepsCompleted.push(...ONBOARDING_STEPS.slice(0, 3));
      expect(isOnboardingComplete(state)).toBe(false);
    });
  });

  // =============================================
  // getProgress
  // =============================================
  describe('getProgress', () => {
    it('throws NotFoundException when company missing', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);
      await expect(service.getProgress('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns fresh state (all pending) for new company', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'c1',
        settings: {},
        logoUrl: null,
        website: null,
        industry: null,
        whatsappPhoneNumberId: null,
      });
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.call.count.mockResolvedValue(0);
      mockPrismaService.whatsappChat.count.mockResolvedValue(0);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.getProgress('c1');

      expect(result.percent).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.steps).toHaveLength(ONBOARDING_STEPS.length);
      expect(result.steps.every((s) => s.status === 'pending')).toBe(true);
    });

    it('auto-detects INVITE_TEAM when userCount > 1', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'c1',
        settings: {},
        logoUrl: null,
        website: null,
        industry: null,
        whatsappPhoneNumberId: null,
      });
      mockPrismaService.user.count.mockResolvedValue(3);
      mockPrismaService.call.count.mockResolvedValue(0);
      mockPrismaService.whatsappChat.count.mockResolvedValue(0);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.getProgress('c1');

      const inviteStep = result.steps.find((s) => s.id === 'INVITE_TEAM');
      expect(inviteStep?.status).toBe('completed');
      expect(result.stepsCompleted).toContain('INVITE_TEAM');
    });

    it('auto-detects FIRST_INTERACTION when any call or chat exists', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'c1',
        settings: {},
        logoUrl: null,
        website: null,
        industry: null,
        whatsappPhoneNumberId: null,
      });
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.call.count.mockResolvedValue(5);
      mockPrismaService.whatsappChat.count.mockResolvedValue(0);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.getProgress('c1');

      expect(result.stepsCompleted).toContain('FIRST_INTERACTION');
    });

    it('auto-detects COMPANY_DETAILS when logo + website + industry set', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'c1',
        settings: {},
        logoUrl: 'https://r2.example/logo.png',
        website: 'https://acme.com',
        industry: 'SaaS',
        whatsappPhoneNumberId: null,
      });
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.call.count.mockResolvedValue(0);
      mockPrismaService.whatsappChat.count.mockResolvedValue(0);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.getProgress('c1');
      expect(result.stepsCompleted).toContain('COMPANY_DETAILS');
    });

    it('does not re-persist when state unchanged', async () => {
      const existingState = EMPTY_ONBOARDING_PROGRESS();
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'c1',
        settings: { onboardingProgress: existingState },
        logoUrl: null,
        website: null,
        industry: null,
        whatsappPhoneNumberId: null,
      });
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.call.count.mockResolvedValue(0);
      mockPrismaService.whatsappChat.count.mockResolvedValue(0);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await service.getProgress('c1');
      expect(mockPrismaService.company.update).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // completeStep
  // =============================================
  describe('completeStep', () => {
    it('adds step to completed list with audit log', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        settings: { onboardingProgress: EMPTY_ONBOARDING_PROGRESS() },
      });
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          company: {
            findUnique: jest.fn().mockResolvedValue({ settings: {} }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.completeStep('c1', 'u1', 'COMPLETE_PROFILE');

      expect(result.stepsCompleted).toContain('COMPLETE_PROFILE');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('is idempotent when step already completed', async () => {
      const state = EMPTY_ONBOARDING_PROGRESS();
      state.stepsCompleted.push('INVITE_TEAM');
      mockPrismaService.company.findUnique.mockResolvedValue({
        settings: { onboardingProgress: state },
      });

      const result = await service.completeStep('c1', 'u1', 'INVITE_TEAM');

      expect(result.stepsCompleted.filter((s) => s === 'INVITE_TEAM')).toHaveLength(1);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('removes step from skipped when completed', async () => {
      const state = EMPTY_ONBOARDING_PROGRESS();
      state.stepsSkipped.push('EXPLORE_ANALYTICS');
      mockPrismaService.company.findUnique.mockResolvedValue({
        settings: { onboardingProgress: state },
      });
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          company: {
            findUnique: jest.fn().mockResolvedValue({ settings: {} }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.completeStep('c1', 'u1', 'EXPLORE_ANALYTICS');

      expect(result.stepsCompleted).toContain('EXPLORE_ANALYTICS');
      expect(result.stepsSkipped).not.toContain('EXPLORE_ANALYTICS');
    });
  });

  // =============================================
  // skipStep
  // =============================================
  describe('skipStep', () => {
    it('adds step to skipped list', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        settings: { onboardingProgress: EMPTY_ONBOARDING_PROGRESS() },
      });
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          company: {
            findUnique: jest.fn().mockResolvedValue({ settings: {} }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.skipStep('c1', 'u1', 'EXPLORE_ANALYTICS', 'not relevant');

      expect(result.stepsSkipped).toContain('EXPLORE_ANALYTICS');
    });

    it('does not skip if already completed', async () => {
      const state = EMPTY_ONBOARDING_PROGRESS();
      state.stepsCompleted.push('INVITE_TEAM');
      mockPrismaService.company.findUnique.mockResolvedValue({
        settings: { onboardingProgress: state },
      });

      const result = await service.skipStep('c1', 'u1', 'INVITE_TEAM');

      expect(result.stepsSkipped).not.toContain('INVITE_TEAM');
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // dismiss
  // =============================================
  describe('dismiss', () => {
    it('sets dismissedAt and persists audit', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        settings: { onboardingProgress: EMPTY_ONBOARDING_PROGRESS() },
      });
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          company: {
            findUnique: jest.fn().mockResolvedValue({ settings: {} }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.dismiss('c1', 'u1', 'prefer docs');

      expect(result.isDismissed).toBe(true);
      expect(result.dismissedAt).toBeTruthy();
    });
  });

  // =============================================
  // reset
  // =============================================
  describe('reset', () => {
    it('returns fresh progress state', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: TxCallback<unknown>) => {
        const tx = {
          company: {
            findUnique: jest.fn().mockResolvedValue({ settings: {} }),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.reset('c1', 'u1');

      expect(result.percent).toBe(0);
      expect(result.stepsCompleted).toHaveLength(0);
      expect(result.stepsSkipped).toHaveLength(0);
      expect(result.isDismissed).toBe(false);
    });
  });
});
