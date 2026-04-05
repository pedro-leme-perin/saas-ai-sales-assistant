import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth('JWT')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard/:companyId')
  @ApiOperation({
    summary: 'Get dashboard KPIs',
    description:
      'Returns high-level KPIs for dashboard: total calls, chats, completion rates, avg sentiment',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard KPIs retrieved successfully',
  })
  async getDashboardKPIs(@Param('companyId') companyId: string) {
    return this.analyticsService.getDashboardKPIs(companyId);
  }

  @Get('calls/:companyId')
  @ApiOperation({
    summary: 'Get call analytics',
    description:
      'Detailed call metrics: volume by date, duration stats, direction breakdown, status distribution',
  })
  @ApiResponse({
    status: 200,
    description: 'Call analytics retrieved successfully',
  })
  async getCallsAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getCallsAnalytics(companyId);
  }

  @Get('whatsapp/:companyId')
  @ApiOperation({
    summary: 'Get WhatsApp analytics',
    description: 'WhatsApp-specific metrics: message volume, chat trends, response patterns',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp analytics retrieved successfully',
  })
  async getWhatsAppAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getWhatsAppAnalytics(companyId);
  }

  @Get('sentiment/:companyId')
  @ApiOperation({
    summary: 'Get sentiment analysis',
    description: 'Customer sentiment distribution and weekly trend line for all conversations',
  })
  @ApiResponse({
    status: 200,
    description: 'Sentiment analytics retrieved successfully',
  })
  async getSentimentAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getSentimentAnalytics(companyId);
  }

  @Get('ai-performance/:companyId')
  @ApiOperation({
    summary: 'Get AI performance metrics',
    description:
      'AI system metrics: provider usage, latency percentiles (p50/p95/p99), confidence scores, adoption rate',
  })
  @ApiResponse({
    status: 200,
    description: 'AI performance metrics retrieved successfully',
  })
  async getAIPerformance(@Param('companyId') companyId: string) {
    return this.analyticsService.getAIPerformance(companyId);
  }

  @Get('audit-logs/:companyId')
  @ApiOperation({
    summary: 'Get audit logs',
    description:
      'Paginated list of audit logs with filtering by action, resource, userId, and date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  async getAuditLogs(
    @Param('companyId') companyId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    return this.analyticsService.getAuditLogs(companyId, {
      page: pageNum,
      limit: limitNum,
      action,
      resource,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}
