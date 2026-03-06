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

    const [totalChats, openChats, messages] = await Promise.all([
      this.prisma.whatsappChat.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.whatsappChat.count({ where: { companyId, status: 'OPEN' } }),
      this.prisma.whatsappMessage.count({
        where: { chat: { companyId }, createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return { totalChats, openChats, messages };
  }
}
