import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(15000);

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: unknown;

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
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
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
    it('should return analytics with success rate', async () => {
      prisma.call.findMany.mockResolvedValue([
        { id: '1', duration: 120, status: 'COMPLETED', createdAt: new Date() },
        { id: '2', duration: 60, status: 'COMPLETED', createdAt: new Date() },
        { id: '3', duration: 0, status: 'FAILED', createdAt: new Date() },
      ]);
      const result = await service.getCallsAnalytics(COMPANY_ID);
      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.successRate).toBe(67); // 2/3 = 67%
    });

    it('should handle empty calls', async () => {
      prisma.call.findMany.mockResolvedValue([]);
      const result = await service.getCallsAnalytics(COMPANY_ID);
      expect(result.total).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.avgDuration).toBe(0);
    });

    it('should group calls by day', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      prisma.call.findMany.mockResolvedValue([
        { id: '1', duration: 120, status: 'COMPLETED', createdAt: today },
        { id: '2', duration: 60, status: 'COMPLETED', createdAt: today },
        { id: '3', duration: 180, status: 'COMPLETED', createdAt: yesterday },
      ]);
      const result = await service.getCallsAnalytics(COMPANY_ID);
      expect(result.byDay).toHaveLength(2);
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
    it('should return sentiment distribution and trend', async () => {
      prisma.call.findMany.mockResolvedValue([
        { sentiment: 0.8, sentimentLabel: 'POSITIVE', createdAt: new Date() },
        { sentiment: 0.6, sentimentLabel: 'NEUTRAL', createdAt: new Date() },
        { sentiment: 0.9, sentimentLabel: 'POSITIVE', createdAt: new Date() },
      ]);
      const result = await service.getSentimentAnalytics(COMPANY_ID);
      expect(result.avgSentiment).toBeCloseTo(0.77, 1);
      expect((result.distribution as unknown as Record<string, number>)['POSITIVE']).toBe(2);
      expect((result.distribution as unknown as Record<string, number>)['NEUTRAL']).toBe(1);
      expect(result.totalAnalyzed).toBe(3);
    });

    it('should handle no sentiment data', async () => {
      prisma.call.findMany.mockResolvedValue([]);
      const result = await service.getSentimentAnalytics(COMPANY_ID);
      expect(result.avgSentiment).toBe(0);
      expect(result.trend).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────
  // getAIPerformance
  // ─────────────────────────────────────────

  describe('getAIPerformance', () => {
    it('should return AI metrics with p95 latency', async () => {
      prisma.aISuggestion.findMany.mockResolvedValue([
        {
          wasUsed: true,
          feedback: 'HELPFUL',
          latencyMs: 500,
          model: 'gpt-4o',
          type: 'GREETING',
          confidence: 0.9,
          createdAt: new Date(),
        },
        {
          wasUsed: false,
          feedback: 'NOT_HELPFUL',
          latencyMs: 800,
          model: 'gpt-4o',
          type: 'OBJECTION_HANDLING',
          confidence: 0.7,
          createdAt: new Date(),
        },
        {
          wasUsed: true,
          feedback: null,
          latencyMs: 300,
          model: 'claude',
          type: 'CLOSING',
          confidence: 0.85,
          createdAt: new Date(),
        },
      ]);
      const result = await service.getAIPerformance(COMPANY_ID);
      expect(result.total).toBe(3);
      expect(result.used).toBe(2);
      expect(result.adoptionRate).toBe(67);
      expect(result.helpfulRate).toBe(50); // 1 helpful / 2 with feedback
      expect(result.avgLatency).toBe(533);
      expect((result.byProvider as unknown as Record<string, unknown>)['gpt-4o']).toHaveProperty(
        'count',
        2,
      );
      expect((result.byProvider as unknown as Record<string, unknown>)['claude']).toHaveProperty(
        'count',
        1,
      );
    });

    it('should handle empty AI data', async () => {
      prisma.aISuggestion.findMany.mockResolvedValue([]);
      const result = await service.getAIPerformance(COMPANY_ID);
      expect(result.total).toBe(0);
      expect(result.adoptionRate).toBe(0);
    });
  });
});
