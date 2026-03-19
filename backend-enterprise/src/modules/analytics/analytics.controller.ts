import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard/:companyId')
  async getDashboardKPIs(@Param('companyId') companyId: string) {
    return this.analyticsService.getDashboardKPIs(companyId);
  }

  @Get('calls/:companyId')
  async getCallsAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getCallsAnalytics(companyId);
  }

  @Get('whatsapp/:companyId')
  async getWhatsAppAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getWhatsAppAnalytics(companyId);
  }

  @Get('sentiment/:companyId')
  async getSentimentAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getSentimentAnalytics(companyId);
  }

  @Get('ai-performance/:companyId')
  async getAIPerformance(@Param('companyId') companyId: string) {
    return this.analyticsService.getAIPerformance(companyId);
  }
}
