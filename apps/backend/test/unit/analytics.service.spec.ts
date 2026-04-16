import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';

jest.setTimeout(15000);

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: unknown;
  let cacheService: Record<string, jest.Mock>;

  const COMPANY_ID = 'company-123';

  beforeEach(async () => {
    prisma = {
      call: {
        count: jest.fn().mockResolvedValue(50),
        aggregate: jest.fn().mockResolvedValue({ _avg: { duration: 180 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      whatsappChat: { count: jest.fn().mockResolvedValue(20) },
      whatsappMessage: { count: jest.fn().mockResolvedValue(100) },
      user: { count: jest.fn().mockResolvedValue(5) },
      aISuggestion: {
        count: jest.fn().mockResolvedValue(30),
        aggregate: jest.fn().mockResolvedValue({ _avg: { latencyMs: null, confidence: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // SQL-level groupBy (byDay) — template-tagged $queryRaw
      $queryRaw: jest.fn().mockResolvedValue([]),
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    };

    cacheService = {
      getJson: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // getDashboardKPIs
  // ─────────────────────────────────────────

  describe('getDashboardKPIs', () => {
    it('should return all KPI sections', async () => {
      const result = await service.getDashboardKPIs(COMPANY_ID);
      expect(result).toHaveProperty('calls');
      expect(result).toHaveProperty('chats');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('ai');
    });

    it('should calculate AI adoption rate', async () => {
      prisma.aISuggestion.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60); // used
      const result = await service.getDashboardKPIs(COMPANY_ID);
      expect(result.ai.adoptionRate).toBe(60);
    });

    it('should handle zero suggestions gracefully', async () => {
      prisma.aISuggestion.count.mockResolvedValue(0);
      const result = await service.getDashboardKPIs(COMPANY_ID);
      expect(result.ai.adoptionRate).toBe(0);
    });

    it('should calculate month-over-month growth', async () => {
      prisma.call.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // this month
        .mockResolvedValueOnce(40); // last month
      const result = await service.getDashboardKPIs(COMPANY_ID);
      expect(result.calls.growth).toBe(50); // (60-40)/40 = 50%
    });
  });

  // ─────────────────────────────────────────
  // getCallsAnalytics
  // ─────────────────────────────────────────

  describe('getCallsAnalytics', () => {
    it('should return analytics with success rate via SQL aggregations', async () => {
      (prisma as { call: Record<string, jest.Mock> }).call.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2); // completed
      (prisma as { call: Record<string, jest.Mock> }).call.aggregate.mockResolvedValue({
        _avg: { duration: 90 },
      });
      (prisma as { $queryRaw: jest.Mock }).$queryRaw.mockResolvedValue([]);

      const result = await service.getCallsAnalytics(COMPANY_ID);

      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.successRate).toBe(67); // 2/3 = 67%
      expect(result.avgDuration).toBe(90);
    });

    it('should handle empty calls', async () => {
      (prisma as { call: Record<string, jest.Mock> }).call.count.mockResolvedValue(0);
      (prisma as { call: Record<string, jest.Mock> }).call.aggregate.mockResolvedValue({
        _avg: { duration: null },
      });
      (prisma as { $queryRaw: jest.Mock }).$queryRaw.mockResolvedValue([]);

      const result = await service.getCallsAnalytics(COMPANY_ID);

      expect(result.total).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.avgDuration).toBe(0);
    });

    it('should use SQL GROUP BY for byDay (not in-memory)', async () => {
      (prisma as { call: Record<string, jest.Mock> }).call.count.mockResolvedValue(3);
      (prisma as { call: Record<string, jest.Mock> }).call.aggregate.mockResolvedValue({
        _avg: { duration: 120 },
      });
      const today = new Date('2026-04-14');
      const yesterday = new Date('2026-04-13');
      (prisma as { $queryRaw: jest.Mock }).$queryRaw.mockResolvedValue([
        { date: yesterday, count: BigInt(1) },
        { date: today, count: BigInt(2) },
      ]);

      const result = await service.getCallsAnalytics(COMPANY_ID);

      expect(result.byDay).toHaveLength(2);
      expect(result.byDay[0].date).toBe('2026-04-13');
      expect(result.byDay[0].calls).toBe(1);
      expect(result.byDay[1].calls).toBe(2);
      // findMany is NOT called anymore — verify SQL path is used
      expect((prisma as { $queryRaw: jest.Mock }).$queryRaw).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // getWhatsAppAnalytics
  // ─────────────────────────────────────────

  describe('getWhatsAppAnalytics', () => {
    it('should return chat metrics with AI adoption', async () => {
      prisma.whatsappChat.count
        .mockResolvedValueOnce(30) // total
        .mockResolvedValueOnce(10); // open
      prisma.whatsappMessage.count
        .mockResolvedValueOnce(200) // messages
        .mockResolvedValueOnce(40); // AI used
      const result = await service.getWhatsAppAnalytics(COMPANY_ID);
      expect(result.totalChats).toBe(30);
      expect(result.openChats).toBe(10);
      expect(result.messages).toBe(200);
      expect(result.aiSuggestionAdoption).toBe(20); // 40/200 = 20%
    });
  });

  // ─────────────────────────────────────────
  // getSentimentAnalytics
  // ─────────────────────────────────────────

  describe('getSentimentAnalytics', () => {
    beforeEach(() => {
      // groupBy is added at runtime by the new implementation
      (prisma as { call: Record<string, jest.Mock> }).call.groupBy = jest.fn();
    });

    it('should return sentiment distribution and trend via SQL', async () => {
      (prisma as { call: Record<string, jest.Mock> }).call.aggregate.mockResolvedValue({
        _count: { _all: 3 },
        _avg: { sentiment: 0.77 },
      });
      (prisma as { call: Record<string, jest.Mock> }).call.groupBy.mockResolvedValue([
        { sentimentLabel: 'POSITIVE', _count: { _all: 2 } },
        { sentimentLabel: 'NEUTRAL', _count: { _all: 1 } },
      ]);
      (prisma as { $queryRaw: jest.Mock }).$queryRaw.mockResolvedValue([
        { week: new Date('2026-04-07'), avg: 0.7, count: BigInt(1) },
        { week: new Date('2026-04-14'), avg: 0.85, count: BigInt(2) },
      ]);

      const result = await service.getSentimentAnalytics(COMPANY_ID);

      expect(result.avgSentiment).toBeCloseTo(0.77, 2);
      expect(result.totalAnalyzed).toBe(3);
      expect((result.distribution as unknown as Record<string, number>)['POSITIVE']).toBe(2);
      expect((result.distribution as unknown as Record<string, number>)['NEUTRAL']).toBe(1);
      expect(result.trend).toHaveLength(2);
      expect(result.trend[0].week).toBe('2026-04-07');
      expect(result.trend[1].calls).toBe(2);
    });

    it('should handle no sentiment data', async () => {
      (prisma as { call: Record<string, jest.Mock> }).call.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _avg: { sentiment: null },
      });
      (prisma as { call: Record<string, jest.Mock> }).call.groupBy.mockResolvedValue([]);
      (prisma as { $queryRaw: jest.Mock }).$queryRaw.mockResolvedValue([]);

      const result = await service.getSentimentAnalytics(COMPANY_ID);
      expect(result.avgSentiment).toBe(0);
      expect(result.totalAnalyzed).toBe(0);
      expect(result.trend).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────
  // getAIPerformance
  // ─────────────────────────────────────────

  describe('getAIPerformance', () => {
    beforeEach(() => {
      // groupBy used by new implementation
      (prisma as { aISuggestion: Record<string, jest.Mock> }).aISuggestion.groupBy = jest.fn();
    });

    it('should return AI metrics from SQL aggregations', async () => {
      const ais = (prisma as { aISuggestion: Record<string, jest.Mock> }).aISuggestion;
      ais.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2) // used
        .mockResolvedValueOnce(1) // helpful
        .mockResolvedValueOnce(2); // withFeedback
      ais.aggregate.mockResolvedValue({
        _avg: { latencyMs: 533, confidence: 0.82 },
      });
      ais.groupBy
        // byProvider total
        .mockResolvedValueOnce([
          { model: 'gpt-4o', _count: { _all: 2 } },
          { model: 'claude', _count: { _all: 1 } },
        ])
        // byProvider used
        .mockResolvedValueOnce([
          { model: 'gpt-4o', _count: { _all: 1 } },
          { model: 'claude', _count: { _all: 1 } },
        ])
        // byType
        .mockResolvedValueOnce([
          { type: 'GREETING', _count: { _all: 1 } },
          { type: 'OBJECTION_HANDLING', _count: { _all: 1 } },
          { type: 'CLOSING', _count: { _all: 1 } },
        ]);
      ais.findMany.mockResolvedValue([{ latencyMs: 500 }, { latencyMs: 800 }, { latencyMs: 300 }]);

      const result = await service.getAIPerformance(COMPANY_ID);

      expect(result.total).toBe(3);
      expect(result.used).toBe(2);
      expect(result.adoptionRate).toBe(67);
      expect(result.helpfulRate).toBe(50);
      expect(result.avgLatency).toBe(533);
      expect(result.avgConfidence).toBeCloseTo(0.82, 2);
      expect(
        (result.byProvider as unknown as Record<string, { count: number; used: number }>)['gpt-4o'],
      ).toEqual({
        count: 2,
        used: 1,
      });
      expect(
        (result.byProvider as unknown as Record<string, { count: number; used: number }>)['claude'],
      ).toEqual({
        count: 1,
        used: 1,
      });
    });

    it('should handle empty AI data', async () => {
      const ais = (prisma as { aISuggestion: Record<string, jest.Mock> }).aISuggestion;
      ais.count.mockResolvedValue(0);
      ais.aggregate.mockResolvedValue({ _avg: { latencyMs: null, confidence: null } });
      ais.groupBy.mockResolvedValue([]);
      ais.findMany.mockResolvedValue([]);

      const result = await service.getAIPerformance(COMPANY_ID);

      expect(result.total).toBe(0);
      expect(result.adoptionRate).toBe(0);
      expect(result.avgLatency).toBe(0);
    });
  });
});
