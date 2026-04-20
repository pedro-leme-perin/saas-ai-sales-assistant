// =============================================
// 🏋️  CoachingService — unit tests (Session 44)
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoachingService } from '../../src/modules/coaching/coaching.service';
import { BackgroundJobsService } from '../../src/modules/background-jobs/background-jobs.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';
import { COACHING_BATCH_SIZE, previousWeekRange } from '../../src/modules/coaching/constants';

const mockCreate = jest.fn();
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
);

jest.setTimeout(15000);

describe('CoachingService', () => {
  let service: CoachingService;

  const mockPrisma = {
    user: { findMany: jest.fn() },
    call: { findMany: jest.fn() },
    whatsappChat: { count: jest.fn() },
    whatsappMessage: { count: jest.fn() },
    aISuggestion: { findMany: jest.fn() },
    coachingReport: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockEmail = {
    sendCoachingReportEmail: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockConfigValues: Record<string, string> = {
    OPENAI_API_KEY: 'test_key',
    OPENAI_MODEL: 'gpt-4o-mini',
  };

  const vendor = {
    id: 'u1',
    name: 'Alice',
    email: 'alice@example.com',
    companyId: 'co1',
    companyName: 'Acme',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEmail.sendCoachingReportEmail.mockResolvedValue({ success: true });
    mockPrisma.coachingReport.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.coachingReport.create.mockResolvedValue({ id: 'default-report-id' });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const mockEventEmitter = { emit: jest.fn().mockReturnValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => mockConfigValues[k]) },
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: BackgroundJobsService,
          useValue: { registerHandler: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CoachingService>(CoachingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // previousWeekRange — pure helper
  // =============================================
  describe('previousWeekRange', () => {
    it('computes prior ISO week (Mon..next Mon) in UTC', () => {
      // Wed 2026-04-15 → prior week: Mon 2026-04-06 .. Mon 2026-04-13
      const r = previousWeekRange(new Date('2026-04-15T10:00:00Z'));
      expect(r.start.toISOString()).toBe('2026-04-06T00:00:00.000Z');
      expect(r.end.toISOString()).toBe('2026-04-13T00:00:00.000Z');
    });

    it('handles Monday today → prior full week', () => {
      const r = previousWeekRange(new Date('2026-04-13T10:00:00Z'));
      expect(r.start.toISOString()).toBe('2026-04-06T00:00:00.000Z');
      expect(r.end.toISOString()).toBe('2026-04-13T00:00:00.000Z');
    });

    it('handles Sunday (end of week) correctly', () => {
      // Sun 2026-04-19 → prior week Mon 04-06 .. Mon 04-13
      const r = previousWeekRange(new Date('2026-04-19T23:59:00Z'));
      expect(r.start.toISOString()).toBe('2026-04-06T00:00:00.000Z');
      expect(r.end.toISOString()).toBe('2026-04-13T00:00:00.000Z');
    });
  });

  // =============================================
  // generateWeeklyReports — cron entrypoint
  // =============================================
  describe('generateWeeklyReports', () => {
    it('no-ops gracefully on empty vendor list', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);
      await service.generateWeeklyReports();
      expect(mockPrisma.coachingReport.create).not.toHaveBeenCalled();
      expect(mockEmail.sendCoachingReportEmail).not.toHaveBeenCalled();
    });

    it('queries vendors with bounded batch size and correct filters', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);
      await service.generateWeeklyReports();
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: COACHING_BATCH_SIZE,
          where: expect.objectContaining({
            isActive: true,
            deletedAt: null,
            scheduledDeletionAt: null,
            role: { in: ['VENDOR', 'MANAGER'] },
          }),
        }),
      );
    });

    it('isolates errors per vendor — one failure does not abort the batch', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { ...vendor, company: { name: vendor.companyName } },
        {
          id: 'u2',
          name: 'Bob',
          email: 'bob@x.com',
          companyId: 'co1',
          company: { name: 'Acme' },
        },
      ]);

      // First vendor throws at findUnique; second succeeds via idempotent skip.
      mockPrisma.coachingReport.findUnique
        .mockRejectedValueOnce(new Error('db glitch'))
        .mockResolvedValueOnce({ id: 'existing' });

      await expect(service.generateWeeklyReports()).resolves.toBeUndefined();
      expect(mockPrisma.coachingReport.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================
  // generateForVendor — idempotent & activity-aware
  // =============================================
  describe('generateForVendor', () => {
    const week = previousWeekRange(new Date('2026-04-15T10:00:00Z'));

    it('is idempotent — skips when report already exists', async () => {
      mockPrisma.coachingReport.findUnique.mockResolvedValueOnce({ id: 'x' });

      await service.generateForVendor(vendor, week);

      expect(mockPrisma.call.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.coachingReport.create).not.toHaveBeenCalled();
      expect(mockEmail.sendCoachingReportEmail).not.toHaveBeenCalled();
    });

    it('under-active vendors skip the LLM and get a stub report', async () => {
      mockPrisma.coachingReport.findUnique.mockResolvedValueOnce(null);
      mockPrisma.call.findMany.mockResolvedValueOnce([]); // total=0
      mockPrisma.whatsappChat.count.mockResolvedValueOnce(0);
      mockPrisma.whatsappMessage.count.mockResolvedValueOnce(0);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([]);
      mockPrisma.call.findMany.mockResolvedValueOnce([]); // sentiment

      mockPrisma.coachingReport.create.mockResolvedValueOnce({ id: 'rep1' });

      await service.generateForVendor(vendor, week);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockPrisma.coachingReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'co1',
            userId: 'u1',
            insights: expect.arrayContaining([expect.stringMatching(/sem atividade/i)]),
            recommendations: expect.any(Array),
          }),
        }),
      );
    });

    it('active vendor: aggregates metrics + invokes LLM + sends email', async () => {
      mockPrisma.coachingReport.findUnique.mockResolvedValueOnce(null);
      // 8 completed + 2 no-answer
      const callRows = [
        ...Array.from({ length: 8 }, () => ({ status: 'COMPLETED', duration: 180 })),
        ...Array.from({ length: 2 }, () => ({ status: 'NO_ANSWER', duration: 0 })),
      ];
      mockPrisma.call.findMany.mockResolvedValueOnce(callRows);
      mockPrisma.whatsappChat.count.mockResolvedValueOnce(4);
      mockPrisma.whatsappMessage.count.mockResolvedValueOnce(32);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([
        ...Array.from({ length: 18 }, () => ({ wasUsed: true })),
        ...Array.from({ length: 12 }, () => ({ wasUsed: false })),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        ...Array.from({ length: 5 }, () => ({ sentimentLabel: 'POSITIVE' })),
        ...Array.from({ length: 2 }, () => ({ sentimentLabel: 'NEGATIVE' })),
        { sentimentLabel: 'NEUTRAL' },
      ]);

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                insights: ['Bom volume de ligações', 'Adoção de IA alta', 'Pipeline saudável'],
                recommendations: ['Mantenha cadência', 'Aumente ticket médio'],
              }),
            },
          },
        ],
      });
      mockPrisma.coachingReport.create.mockResolvedValueOnce({ id: 'rep1' });

      await service.generateForVendor(vendor, week);

      expect(mockCreate).toHaveBeenCalledTimes(1);

      const createArg = mockPrisma.coachingReport.create.mock.calls[0][0];
      expect(createArg.data.metrics.calls).toEqual(
        expect.objectContaining({
          total: 10,
          completed: 8,
          missed: 2,
          conversionRate: 0.8,
        }),
      );
      expect(createArg.data.metrics.whatsapp).toEqual(
        expect.objectContaining({ chats: 4, messagesSent: 32 }),
      );
      expect(createArg.data.metrics.ai).toEqual(
        expect.objectContaining({
          suggestionsShown: 30,
          suggestionsUsed: 18,
          adoptionRate: 0.6,
        }),
      );
      expect(createArg.data.metrics.sentiment).toEqual({
        positive: 5,
        neutral: 1,
        negative: 2,
      });
      expect(createArg.data.insights).toHaveLength(3);
      expect(createArg.data.recommendations).toHaveLength(2);

      // Email + audit are fire-and-forget.
      await new Promise((r) => setImmediate(r));
      expect(mockEmail.sendCoachingReportEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'alice@example.com',
          companyName: 'Acme',
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('falls back deterministically when LLM throws', async () => {
      mockPrisma.coachingReport.findUnique.mockResolvedValueOnce(null);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        ...Array.from({ length: 2 }, () => ({ status: 'COMPLETED', duration: 100 })),
        ...Array.from({ length: 5 }, () => ({ status: 'NO_ANSWER', duration: 0 })),
      ]);
      mockPrisma.whatsappChat.count.mockResolvedValueOnce(1);
      mockPrisma.whatsappMessage.count.mockResolvedValueOnce(10);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([
        ...Array.from({ length: 2 }, () => ({ wasUsed: true })),
        ...Array.from({ length: 8 }, () => ({ wasUsed: false })),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([]);

      mockCreate.mockRejectedValueOnce(new Error('llm down'));
      mockPrisma.coachingReport.create.mockResolvedValueOnce({ id: 'rep1' });

      await service.generateForVendor(vendor, week);

      const createArg = mockPrisma.coachingReport.create.mock.calls[0][0];
      expect(createArg.data.insights.length).toBeGreaterThan(0);
      expect(createArg.data.recommendations.length).toBeGreaterThan(0);
      // Low adoption + low conversion triggers specific recommendations.
      expect(createArg.data.recommendations.some((r: string) => /sugestoes de IA/i.test(r))).toBe(
        true,
      );
    });

    it('email failure flags the report without throwing', async () => {
      mockPrisma.coachingReport.findUnique.mockResolvedValueOnce(null);
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      mockPrisma.whatsappChat.count.mockResolvedValueOnce(0);
      mockPrisma.whatsappMessage.count.mockResolvedValueOnce(0);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([]);
      mockPrisma.call.findMany.mockResolvedValueOnce([]);

      mockPrisma.coachingReport.create.mockResolvedValueOnce({ id: 'rep1' });
      mockEmail.sendCoachingReportEmail.mockResolvedValueOnce({
        success: false,
        error: 'smtp down',
      });

      await expect(service.generateForVendor(vendor, week)).resolves.toBeUndefined();

      // updateMany is called inside fire-and-forget sendReportEmail wrapper.
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.coachingReport.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', weekStart: week.start },
          data: { emailError: 'delivery_failed' },
        }),
      );
    });
  });
});
