import { Controller, Get, Param } from '@nestjs/common';
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
    description: 'Returns high-level KPIs for dashboard: total calls, chats, completion rates, avg sentiment',
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
}
