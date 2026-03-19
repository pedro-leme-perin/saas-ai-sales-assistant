import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKPIs(companyId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalCalls, callsThisMonth, callsLastMonth,
      totalChats, chatsThisMonth, chatsLastMonth,
      totalUsers,
      totalSuggestions, suggestionsUsed,
      avgDurationResult,
    ] = await Promise.all([
      this.prisma.call.count({ where: { companyId } }),
      this.prisma.call.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
      this.prisma.call.count({ where: { companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      this.prisma.whatsappChat.count({ where: { companyId } }),
      this.prisma.whatsappChat.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
      this.prisma.whatsappChat.count({ where: { companyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      this.prisma.user.count({ where: { companyId } }),
      this.prisma.aISuggestion.count({ where: { call: { companyId } } }),
      this.prisma.aISuggestion.count({ where: { call: { companyId }, wasUsed: true } }),
      this.prisma.call.aggregate({ where: { companyId, status: 'COMPLETED' }, _avg: { duration: true } }),
    ]);

    const callsGrowth = callsLastMonth > 0
      ? Math.round(((callsThisMonth - callsLastMonth) / callsLastMonth) * 100)
      : 0;
    const chatsGrowth = chatsLastMonth > 0
      ? Math.round(((chatsThisMonth - chatsLastMonth) / chatsLastMonth) * 100)
      : 0;

    return {
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
        adoptionRate: totalSuggestions > 0 ? Math.round((suggestionsUsed / totalSuggestions) * 100) : 0,
      },
    };
  }

  async getCallsAnalytics(companyId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const calls = await this.prisma.call.findMany({
      where: { companyId, createdAt: { gte: thirtyDaysAgo } },
      select: { id: true, duration: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay: Record<string, { date: string; calls: number }> = {};
    for (const call of calls) {
      const date = call.createdAt.toISOString().split('T')[0];
      if (!byDay[date]) byDay[date] = { date, calls: 0 };
      byDay[date].calls++;
    }

    const completed = calls.filter(c => c.status === 'COMPLETED').length;
    const total = calls.length;

    return {
      total,
      completed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDuration: total > 0 ? Math.round(calls.reduce((s, c) => s + (c.duration || 0), 0) / total) : 0,
      byDay: Object.values(byDay),
    };
  }

  async getWhatsAppAnalytics(companyId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalChats, openChats, messages, aiUsedMessages] = await Promise.all([
      this.prisma.whatsappChat.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.whatsappChat.count({ where: { companyId, status: 'OPEN' } }),
      this.prisma.whatsappMessage.count({
        where: { chat: { companyId }, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.whatsappMessage.count({
        where: { chat: { companyId }, createdAt: { gte: thirtyDaysAgo }, aiSuggestionUsed: true },
      }),
    ]);

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

    const calls = await this.prisma.call.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        sentiment: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { sentiment: true, sentimentLabel: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (calls.length === 0) {
      return { avgSentiment: 0, distribution: {}, trend: [] };
    }

    // Average sentiment
    const avgSentiment = calls.reduce((sum, c) => sum + (c.sentiment || 0), 0) / calls.length;

    // Distribution by label
    const distribution: Record<string, number> = {};
    for (const call of calls) {
      const label = call.sentimentLabel || 'UNKNOWN';
      distribution[label] = (distribution[label] || 0) + 1;
    }

    // Weekly trend (avg sentiment per week)
    const weeklyMap: Record<string, { total: number; count: number }> = {};
    for (const call of calls) {
      const weekStart = this.getWeekStart(call.createdAt);
      if (!weeklyMap[weekStart]) weeklyMap[weekStart] = { total: 0, count: 0 };
      weeklyMap[weekStart].total += call.sentiment || 0;
      weeklyMap[weekStart].count++;
    }

    const trend = Object.entries(weeklyMap)
      .map(([week, data]) => ({
        week,
        avgSentiment: Math.round((data.total / data.count) * 100) / 100,
        calls: data.count,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return {
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      distribution,
      trend,
      totalAnalyzed: calls.length,
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
        OR: [
          { call: { companyId } },
          { chat: { companyId } },
        ],
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
    });

    if (suggestions.length === 0) {
      return { total: 0, adoptionRate: 0, avgLatency: 0, byProvider: {}, byType: {} };
    }

    const used = suggestions.filter(s => s.wasUsed).length;
    const helpful = suggestions.filter(s => s.feedback === 'HELPFUL').length;
    const withFeedback = suggestions.filter(s => s.feedback !== null).length;
    const latencies = suggestions.filter(s => s.latencyMs != null).map(s => s.latencyMs!);

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
      avgLatency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p95Latency: latencies.length > 0 ? this.percentile(latencies, 95) : 0,
      avgConfidence: Math.round(
        (suggestions.reduce((sum, s) => sum + (s.confidence || 0), 0) / suggestions.length) * 100,
      ) / 100,
      byProvider,
      byType,
    };
  }

  private getWeekStart(date: Date): string {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
