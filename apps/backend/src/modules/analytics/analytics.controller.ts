import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TenantGuard } from '@/modules/auth/guards/tenant.guard';

@ApiTags('analytics')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard/:companyId')
  @ApiOperation({
    summary: 'Get dashboard KPIs',
    description:
      'Returns high-level KPIs for the dashboard overview. Includes total calls, chats, ' +
      'month-over-month growth, AI suggestion adoption rate, average call duration, and user count. ' +
      'Results are cached for 5 minutes in Redis.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID', example: 'clx1abc2def3ghi4jkl' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard KPIs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalCalls: { type: 'number', example: 1250 },
        callsThisMonth: { type: 'number', example: 87 },
        callsGrowth: { type: 'number', example: 12, description: 'Month-over-month growth %' },
        totalChats: { type: 'number', example: 430 },
        chatsThisMonth: { type: 'number', example: 52 },
        chatsGrowth: { type: 'number', example: -3 },
        totalUsers: { type: 'number', example: 8 },
        aiAdoptionRate: {
          type: 'number',
          example: 73,
          description: 'Percentage of AI suggestions used',
        },
        avgCallDuration: {
          type: 'number',
          example: 245,
          description: 'Average duration in seconds',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized -- missing or invalid JWT' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden -- companyId does not match authenticated user tenant',
  })
  async getDashboardKPIs(@Param('companyId') companyId: string) {
    return this.analyticsService.getDashboardKPIs(companyId);
  }

  @Get('calls/:companyId')
  @ApiOperation({
    summary: 'Get call analytics',
    description:
      'Detailed call metrics including daily volume time series, average/min/max duration statistics, ' +
      'inbound vs outbound direction breakdown, and status distribution (completed, missed, failed, etc.).',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({
    status: 200,
    description: 'Call analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        volumeByDate: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2026-04-15' },
              count: { type: 'number', example: 23 },
            },
          },
        },
        durationStats: {
          type: 'object',
          properties: {
            avg: { type: 'number', example: 245 },
            min: { type: 'number', example: 12 },
            max: { type: 'number', example: 1800 },
          },
        },
        directionBreakdown: {
          type: 'object',
          properties: {
            INBOUND: { type: 'number', example: 650 },
            OUTBOUND: { type: 'number', example: 600 },
          },
        },
        statusDistribution: {
          type: 'object',
          properties: {
            COMPLETED: { type: 'number', example: 980 },
            MISSED: { type: 'number', example: 120 },
            FAILED: { type: 'number', example: 15 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden -- tenant mismatch' })
  async getCallsAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getCallsAnalytics(companyId);
  }

  @Get('whatsapp/:companyId')
  @ApiOperation({
    summary: 'Get WhatsApp analytics',
    description:
      'WhatsApp-specific metrics including daily message volume, chat open/close trends, ' +
      'average response time, and priority distribution across conversations.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalChats: { type: 'number', example: 430 },
        totalMessages: { type: 'number', example: 3200 },
        messagesByDate: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2026-04-15' },
              count: { type: 'number', example: 45 },
            },
          },
        },
        avgResponseTime: {
          type: 'number',
          example: 120,
          description: 'Average response time in seconds',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden -- tenant mismatch' })
  async getWhatsAppAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getWhatsAppAnalytics(companyId);
  }

  @Get('sentiment/:companyId')
  @ApiOperation({
    summary: 'Get sentiment analysis',
    description:
      'Customer sentiment distribution across all calls (VERY_POSITIVE, POSITIVE, NEUTRAL, NEGATIVE, VERY_NEGATIVE) ' +
      'and a weekly trend line. Uses the composite index [companyId, sentiment] for efficient querying.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({
    status: 200,
    description: 'Sentiment analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        distribution: {
          type: 'object',
          properties: {
            VERY_POSITIVE: { type: 'number', example: 120 },
            POSITIVE: { type: 'number', example: 340 },
            NEUTRAL: { type: 'number', example: 280 },
            NEGATIVE: { type: 'number', example: 85 },
            VERY_NEGATIVE: { type: 'number', example: 25 },
          },
        },
        weeklyTrend: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week: { type: 'string', example: '2026-W15' },
              avgScore: { type: 'number', example: 0.72 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden -- tenant mismatch' })
  async getSentimentAnalytics(@Param('companyId') companyId: string) {
    return this.analyticsService.getSentimentAnalytics(companyId);
  }

  @Get('ai-performance/:companyId')
  @ApiOperation({
    summary: 'Get AI performance metrics',
    description:
      'AI system metrics including per-provider usage counts, latency percentiles (p50, p95, p99), ' +
      'average confidence scores, suggestion adoption rate, and circuit breaker status for each provider.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({
    status: 200,
    description: 'AI performance metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalSuggestions: { type: 'number', example: 4500 },
        adoptionRate: {
          type: 'number',
          example: 73.2,
          description: 'Percentage of suggestions accepted',
        },
        avgConfidence: {
          type: 'number',
          example: 0.85,
          description: 'Average confidence score (0-1)',
        },
        latencyPercentiles: {
          type: 'object',
          properties: {
            p50: { type: 'number', example: 320, description: 'Median latency in ms' },
            p95: { type: 'number', example: 890, description: '95th percentile latency in ms' },
            p99: { type: 'number', example: 1850, description: '99th percentile latency in ms' },
          },
        },
        providerUsage: {
          type: 'object',
          properties: {
            openai: { type: 'number', example: 3800 },
            anthropic: { type: 'number', example: 500 },
            gemini: { type: 'number', example: 200 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden -- tenant mismatch' })
  async getAIPerformance(@Param('companyId') companyId: string) {
    return this.analyticsService.getAIPerformance(companyId);
  }

  @Get('audit-logs/:companyId')
  @ApiOperation({
    summary: 'Get audit logs',
    description:
      'Paginated list of audit trail entries. Supports filtering by action type, resource, ' +
      'user, and date range. Returns entries sorted by most recent first. ' +
      'Limit is clamped to 1-100 per page.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: '1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page, max 100 (default: 20)',
    example: '20',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    description: 'Filter by audit action (e.g., CREATE, UPDATE, DELETE)',
    example: 'UPDATE',
  })
  @ApiQuery({
    name: 'resource',
    required: false,
    description: 'Filter by resource type (e.g., User, Company, Call)',
    example: 'User',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID who performed the action',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'ISO 8601 start date filter',
    example: '2026-04-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'ISO 8601 end date filter',
    example: '2026-04-17T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'clx1abc2def3ghi4jkl' },
              action: { type: 'string', example: 'UPDATE' },
              resource: { type: 'string', example: 'User' },
              resourceId: { type: 'string', example: 'clx9xyz...' },
              userId: { type: 'string', example: 'clx5user...' },
              createdAt: { type: 'string', example: '2026-04-16T14:30:00Z' },
              metadata: { type: 'object', description: 'Old/new values and request context' },
            },
          },
        },
        total: { type: 'number', example: 156 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden -- tenant mismatch' })
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
