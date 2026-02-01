import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKPIs(companyId: string) {
    const [totalCalls, totalChats, totalUsers] = await Promise.all([
      this.prisma.call.count({ where: { companyId } }),
      this.prisma.whatsappChat.count({ where: { companyId } }),
      this.prisma.user.count({ where: { companyId } }),
    ]);

    return {
      totalCalls,
      totalChats,
      totalUsers,
    };
  }

  async getCallsAnalytics(companyId: string) {
    const calls = await this.prisma.call.findMany({
      where: { companyId },
      select: {
        id: true,
        duration: true,
        sentiment: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      total: calls.length,
      calls,
    };
  }
}