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

  /**
   * Cache key for dashboard KPIs. Public so other services
   * (billing, companies) can invalidate after writes.
   */
  static dashboardCacheKey(companyId: string): string {
    return `analytics:dashboard:${companyId}`;
  }

  /**
   * Invalidate all analytics caches for a company.
   * Call after any mutation that affects KPIs (plan change, user invite,
   * onboarding completion, etc.).
   */
  async invalidateCompanyCache(companyId: string): Promise<void> {
    await this.cache.del(AnalyticsService.dashboardCacheKey(companyId));
  }

  async getDashboardKPIs(companyId: string) {
    // Cache dashboard KPIs for 5 minutes (System Design Interview Cap. 4)
    const cacheKey = AnalyticsService.dashboardCacheKey(companyId);
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
        // @ts-expect-error Prisma groupBy types overly strict with sentiment/status where clause
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
    for (const row of byLabel as { sentimentLabel: string | null; _count: { _all: number } }[]) {
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

    // Tenant filter shared by all aggregations (suggestion → call OR chat → company)
    const baseWhere = {
      createdAt: { gte: thirtyDaysAgo },
      OR: [{ call: { companyId } }, { chat: { companyId } }],
    };

    // ADR-008: SQL-level aggregation. p95 stays in JS but only loads
    // latencyMs column (small payload).
    const [
      total,
      used,
      helpful,
      withFeedback,
      agg,
      byProviderTotal,
      byProviderUsed,
      byTypeRaw,
      latencyRows,
    ] = await promiseAllWithTimeout(
      [
        this.prisma.aISuggestion.count({ where: baseWhere }),
        this.prisma.aISuggestion.count({ where: { ...baseWhere, wasUsed: true } }),
        this.prisma.aISuggestion.count({ where: { ...baseWhere, feedback: 'HELPFUL' } }),
        this.prisma.aISuggestion.count({ where: { ...baseWhere, feedback: { not: null } } }),
        this.prisma.aISuggestion.aggregate({
          where: baseWhere,
          _avg: { latencyMs: true, confidence: true },
        }),
        // @ts-expect-error Prisma groupBy types don't support relation filters in where
        this.prisma.aISuggestion.groupBy({
          by: ['model'],
          where: baseWhere,
          _count: { _all: true },
        }),
        // @ts-expect-error Prisma groupBy types don't support relation filters in where
        this.prisma.aISuggestion.groupBy({
          by: ['model'],
          where: { ...baseWhere, wasUsed: true },
          _count: { _all: true },
        }),
        // @ts-expect-error Prisma groupBy types don't support relation filters in where
        this.prisma.aISuggestion.groupBy({
          by: ['type'],
          where: baseWhere,
          _count: { _all: true },
        }),
        // p95: load only latencyMs column (~8 bytes/row vs full row ~300 bytes)
        this.prisma.aISuggestion.findMany({
          where: { ...baseWhere, latencyMs: { not: null } },
          select: { latencyMs: true },
          take: 10000,
        }),
      ],
      15000,
      'getAIPerformance',
    );

    if (total === 0) {
      return {
        total: 0,
        adoptionRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        byProvider: {},
        byType: {},
      };
    }

    // Merge byProvider total + used into single map
    type GroupByModel = { model: string | null; _count: { _all: number } };
    type GroupByType = { type: string; _count: { _all: number } };

    const byProvider: Record<string, { count: number; used: number }> = {};
    for (const row of byProviderTotal as GroupByModel[]) {
      const model = row.model || 'unknown';
      byProvider[model] = { count: row._count._all, used: 0 };
    }
    for (const row of byProviderUsed as GroupByModel[]) {
      const model = row.model || 'unknown';
      if (byProvider[model]) byProvider[model].used = row._count._all;
    }

    const byType: Record<string, number> = {};
    for (const row of byTypeRaw as GroupByType[]) {
      byType[row.type] = row._count._all;
    }

    const latencies = latencyRows.map((r) => r.latencyMs!).filter((v): v is number => v != null);

    return {
      total,
      used,
      adoptionRate: Math.round((used / total) * 100),
      helpfulRate: withFeedback > 0 ? Math.round((helpful / withFeedback) * 100) : 0,
      avgLatency: Math.round(agg._avg.latencyMs ?? 0),
      p95Latency: latencies.length > 0 ? this.percentile(latencies, 95) : 0,
      avgConfidence: Math.round((agg._avg.confidence ?? 0) * 100) / 100,
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

  /**
   * Session 43 — Audit log export (compliance / regulator).
   * Streams up to `maxRows` rows matching the filters, sorted oldest→newest
   * so CSV consumers can process chronologically.
   */
  async *exportAuditLogs(
    companyId: string,
    filters: {
      action?: string;
      resource?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      maxRows: number;
    },
  ): AsyncGenerator<{
    id: string;
    createdAt: Date;
    action: string;
    resource: string;
    resourceId: string | null;
    description: string | null;
    userId: string | null;
    userEmail: string | null;
    userName: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    oldValues: unknown;
    newValues: unknown;
  }> {
    const where: Record<string, unknown> = { companyId };
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.userId) where.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, unknown>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, unknown>).lte = filters.endDate;
      }
    }

    const pageSize = 500;
    let emitted = 0;
    let cursor: string | undefined;

    while (emitted < filters.maxRows) {
      const batch = await this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: Math.min(pageSize, filters.maxRows - emitted),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (batch.length === 0) return;

      for (const log of batch) {
        yield {
          id: log.id,
          createdAt: log.createdAt,
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId,
          description: log.description,
          userId: log.userId,
          userEmail: log.user?.email ?? null,
          userName: log.user?.name ?? null,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          requestId: log.requestId,
          oldValues: log.oldValues,
          newValues: log.newValues,
        };
        emitted++;
      }

      cursor = batch[batch.length - 1].id;
      if (batch.length < pageSize) return;
    }
  }
}
