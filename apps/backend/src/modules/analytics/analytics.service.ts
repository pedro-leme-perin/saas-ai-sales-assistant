import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { promiseAllWithTimeout } from '../../common/resilience/promise-timeout';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getDashboardKPIs(companyId: string) {
    // Cache dashboard KPIs for 5 minutes (System Design Interview Cap. 4)
    const cacheKey = `analytics:dashboard:${companyId}`;
    const cached = await this.cache.getJson<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalCalls,
      callsThisMonth,
      callsLastMonth,
      totalChats,
      chatsThisMonth,
      chatsLastMonth,
      totalUsers,
      totalSuggestions,
      suggestionsUsed,
      avgDurationResult,
    ] = await promiseAllWithTimeout(
      [
        this.prisma.call.count({ where: { companyId } }),
        this.prisma.call.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
        this.prisma.call.count({
          where: { companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        }),
        this.prisma.whatsappChat.count({ where: { companyId } }),
        this.prisma.whatsappChat.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
        this.prisma.whatsappChat.count({
          where: { companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        }),
        this.prisma.user.count({ where: { companyId } }),
        this.prisma.aISuggestion.count({ where: { call: { companyId } } }),
        this.prisma.aISuggestion.count({ where: { call: { companyId }, wasUsed: true } }),
        this.prisma.call.aggregate({
          where: { companyId, status: 'COMPLETED' },
          _avg: { duration: true },
        }),
      ],
      15000,
      'getDashboardKPIs',
    );

    const callsGrowth =
      callsLastMonth > 0
        ? Math.round(((callsThisMonth - callsLastMonth) / callsLastMonth) * 100)
        : 0;
    const chatsGrowth =
      chatsLastMonth > 0
        ? Math.round(((chatsThisMonth - chatsLastMonth) / chatsLastMonth) * 100)
        : 0;

    const result = {
      calls: {
        total: totalCalls,
        thisMonth: callsThisMonth,
        growth: callsGrowth,
        avgDuration: Math.round(avgDurationResult._avg.duration || 0),
      },
      chats: {
        total: totalChats,
        thisMonth: chatsThisMonth,
        growth: chatsGrowth,
      },
      users: { total: totalUsers },
      ai: {
        total: totalSuggestions,
        used: suggestionsUsed,
        adoptionRate:
          totalSuggestions > 0 ? Math.round((suggestionsUsed / totalSuggestions) * 100) : 0,
      },
    };

    await this.cache.set(cacheKey, result, 300); // 5 min TTL
    return result;
  }

  async getCallsAnalytics(companyId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // SQL-level aggregation (DDIA Cap. 3 — push computation to storage layer)
    // Replaces findMany(10000) + JS loops with count + aggregate + groupBy
    const [total, completed, agg, byDayRaw] = await promiseAllWithTimeout(
      [
        this.prisma.call.count({
          where: { companyId, createdAt: { gte: thirtyDaysAgo } },
        }),
        this.prisma.call.count({
          where: { companyId, createdAt: { gte: thirtyDaysAgo }, status: 'COMPLETED' },
        }),
        this.prisma.call.aggregate({
          where: { companyId, createdAt: { gte: thirtyDaysAgo } },
          _avg: { duration: true },
        }),
        this.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT DATE("createdAt") AS date, COUNT(*)::bigint AS count
          FROM "Call"
          WHERE "companyId" = ${companyId} AND "createdAt" >= ${thirtyDaysAgo}
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `,
      ],
      15000,
      'getCallsAnalytics',
    );

    return {
      total,
      completed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDuration: Math.round(agg._avg.duration ?? 0),
      byDay: byDayRaw.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        calls: Number(r.count),
      })),
    };
  }

  async getWhatsAppAnalytics(companyId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalChats, openChats, messages, aiUsedMessages] = await promiseAllWithTimeout(
      [
        this.prisma.whatsappChat.count({
          where: { companyId, createdAt: { gte: thirtyDaysAgo } },
        }),
        this.prisma.whatsappChat.count({ where: { companyId, status: 'OPEN' } }),
        this.prisma.whatsappMessage.count({
          where: { chat: { companyId }, createdAt: { gte: thirtyDaysAgo } },
        }),
        this.prisma.whatsappMessage.count({
          where: {
            chat: { companyId },
            createdAt: { gte: thirtyDaysAgo },
            aiSuggestionUsed: true,
          },
        }),
      ],
      15000,
      'getWhatsAppAnalytics',
    );

    return {
      totalChats,
      openChats,
      messages,
      aiSuggestionAdoption: messages > 0 ? Math.round((aiUsedMessages / messages) * 100) : 0,
    };
  }

  // ─────────────────────────────────────────
  // SENTIMENT ANALYTICS
  // ─────────────────────────────────────────
  // Designing ML Systems — Monitoring chapter:
  // Track prediction distributions over time
  async getSentimentAnalytics(companyId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // SQL-level aggregation per ADR-008
    // Uses index [companyId, sentiment] (sessão 37) + [companyId, createdAt]
    const baseWhere = {
      companyId,
      status: 'COMPLETED' as const,
      sentiment: { not: null },
      createdAt: { gte: thirtyDaysAgo },
    };

    const [agg, byLabel, weeklyTrend] = await promiseAllWithTimeout(
      [
        // Total count + avg sentiment
        this.prisma.call.aggregate({
          where: baseWhere,
          _count: { _all: true },
          _avg: { sentiment: true },
        }),
        // Distribution by sentiment label (SQL groupBy)
        this.prisma.call.groupBy({
          by: ['sentimentLabel'],
          where: baseWhere,
          _count: { _all: true },
        }),
        // Weekly trend via $queryRaw — date_trunc keeps us in SQL
        this.prisma.$queryRaw<Array<{ week: Date; avg: number; count: bigint }>>`
          SELECT
            date_trunc('week', "created_at") AS week,
            AVG("sentiment")::float AS avg,
            COUNT(*)::bigint AS count
          FROM "calls"
          WHERE "company_id" = ${companyId}
            AND "status" = 'COMPLETED'
            AND "sentiment" IS NOT NULL
            AND "created_at" >= ${thirtyDaysAgo}
          GROUP BY week
          ORDER BY week ASC
        `,
      ],
      15000,
      'getSentimentAnalytics',
    );

    const totalAnalyzed = agg._count._all;
    if (totalAnalyzed === 0) {
      return { avgSentiment: 0, distribution: {}, trend: [], totalAnalyzed: 0 };
    }

    const distribution: Record<string, number> = {};
    for (const row of byLabel) {
      const label = row.sentimentLabel || 'UNKNOWN';
      distribution[label] = row._count._all;
    }

    const trend = weeklyTrend.map((r) => ({
      week: r.week.toISOString().split('T')[0],
      avgSentiment: Math.round((r.avg ?? 0) * 100) / 100,
      calls: Number(r.count),
    }));

    return {
      avgSentiment: Math.round((agg._avg.sentiment ?? 0) * 100) / 100,
      distribution,
      trend,
      totalAnalyzed,
    };
  }

  // ─────────────────────────────────────────
  // AI PERFORMANCE ANALYTICS
  // ─────────────────────────────────────────
  // Designing ML Systems — Monitoring:
  // Track accuracy-related metrics, latency, adoption
  async getAIPerformance(companyId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const suggestions = await this.prisma.aISuggestion.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        OR: [{ call: { companyId } }, { chat: { companyId } }],
      },
      select: {
        wasUsed: true,
        feedback: true,
        latencyMs: true,
        model: true,
        type: true,
        confidence: true,
        createdAt: true,
      },
      take: 10000,
    });

    if (suggestions.length === 0) {
      return { total: 0, adoptionRate: 0, avgLatency: 0, byProvider: {}, byType: {} };
    }

    const used = suggestions.filter((s) => s.wasUsed).length;
    const helpful = suggestions.filter((s) => s.feedback === 'HELPFUL').length;
    const withFeedback = suggestions.filter((s) => s.feedback !== null).length;
    const latencies = suggestions.filter((s) => s.latencyMs != null).map((s) => s.latencyMs!);

    // By provider
    const byProvider: Record<string, { count: number; used: number }> = {};
    for (const s of suggestions) {
      const model = s.model || 'unknown';
      if (!byProvider[model]) byProvider[model] = { count: 0, used: 0 };
      byProvider[model].count++;
      if (s.wasUsed) byProvider[model].used++;
    }

    // By type
    const byType: Record<string, number> = {};
    for (const s of suggestions) {
      byType[s.type] = (byType[s.type] || 0) + 1;
    }

    return {
      total: suggestions.length,
      used,
      adoptionRate: Math.round((used / suggestions.length) * 100),
      helpfulRate: withFeedback > 0 ? Math.round((helpful / withFeedback) * 100) : 0,
      avgLatency:
        latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0,
      p95Latency: latencies.length > 0 ? this.percentile(latencies, 95) : 0,
      avgConfidence:
        Math.round(
          (suggestions.reduce((sum, s) => sum + (s.confidence || 0), 0) / suggestions.length) * 100,
        ) / 100,
      byProvider,
      byType,
    };
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // ─────────────────────────────────────────
  // AUDIT LOG ANALYTICS
  // ─────────────────────────────────────────
  async getAuditLogs(
    companyId: string,
    filters: {
      page: number;
      limit: number;
      action?: string;
      resource?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    // Build WHERE clause with filters
    const where: Record<string, unknown> = {
      companyId,
    };

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.resource) {
      where.resource = filters.resource;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, unknown>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, unknown>).lte = filters.endDate;
      }
    }

    // Get total count
    const total = await this.prisma.auditLog.count({ where });

    // Get paginated results
    const skip = (filters.page - 1) * filters.limit;
    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
    });

    const totalPages = Math.ceil(total / filters.limit);

    return {
      data: logs,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages,
      },
    };
  }
}
