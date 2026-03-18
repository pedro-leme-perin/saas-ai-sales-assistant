import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from '../../src/modules/analytics/analytics.controller';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service';

jest.setTimeout(15000);

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: jest.Mocked<Partial<AnalyticsService>>;

  const mockDashboardKPIs = {
    totalCalls: 150,
    totalChats: 200,
    avgSentiment: 0.78,
    avgCallDuration: 240,
    activeUsers: 8,
    callsToday: 12,
    chatsToday: 25,
    aiSuggestionsUsed: 89,
  };

  const mockCallsAnalytics = {
    callsByDay: [
      { date: '2026-03-10', count: 15 },
      { date: '2026-03-11', count: 22 },
      { date: '2026-03-12', count: 18 },
    ],
    callsByStatus: { COMPLETED: 120, FAILED: 10, IN_PROGRESS: 5 },
    avgDurationByDay: [
      { date: '2026-03-10', avgDuration: 180 },
      { date: '2026-03-11', avgDuration: 220 },
    ],
    sentimentTrend: [
      { date: '2026-03-10', avgSentiment: 0.72 },
      { date: '2026-03-11', avgSentiment: 0.80 },
    ],
  };

  const mockWhatsAppAnalytics = {
    messagesByDay: [
      { date: '2026-03-10', incoming: 30, outgoing: 25 },
      { date: '2026-03-11', incoming: 45, outgoing: 40 },
    ],
    activeChats: 15,
    avgResponseTime: 120,
    aiSuggestionAcceptRate: 0.65,
  };

  beforeEach(async () => {
    analyticsService = {
      getDashboardKPIs: jest.fn().mockResolvedValue(mockDashboardKPIs),
      getCallsAnalytics: jest.fn().mockResolvedValue(mockCallsAnalytics),
      getWhatsAppAnalytics: jest.fn().mockResolvedValue(mockWhatsAppAnalytics),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  // ─────────────────────────────────────────
  // GET /analytics/dashboard/:companyId
  // ─────────────────────────────────────────

  describe('getDashboardKPIs', () => {
    it('should return dashboard KPIs for company', async () => {
      const result = await controller.getDashboardKPIs('company-123');
      expect(result).toEqual(mockDashboardKPIs);
      expect(analyticsService.getDashboardKPIs).toHaveBeenCalledWith('company-123');
    });

    it('should pass correct companyId', async () => {
      await controller.getDashboardKPIs('company-456');
      expect(analyticsService.getDashboardKPIs).toHaveBeenCalledWith('company-456');
    });
  });

  // ─────────────────────────────────────────
  // GET /analytics/calls/:companyId
  // ─────────────────────────────────────────

  describe('getCallsAnalytics', () => {
    it('should return calls analytics', async () => {
      const result = await controller.getCallsAnalytics('company-123');
      expect(result).toEqual(mockCallsAnalytics);
      expect(analyticsService.getCallsAnalytics).toHaveBeenCalledWith('company-123');
    });
  });

  // ─────────────────────────────────────────
  // GET /analytics/whatsapp/:companyId
  // ─────────────────────────────────────────

  describe('getWhatsAppAnalytics', () => {
    it('should return WhatsApp analytics', async () => {
      const result = await controller.getWhatsAppAnalytics('company-123');
      expect(result).toEqual(mockWhatsAppAnalytics);
      expect(analyticsService.getWhatsAppAnalytics).toHaveBeenCalledWith('company-123');
    });
  });
});
