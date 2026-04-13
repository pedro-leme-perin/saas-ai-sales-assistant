import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { Public } from '@/common/decorators/public.decorator';
import { TenantGuard } from '@/modules/auth/guards/tenant.guard';
import { AIProviderType } from '@/infrastructure/ai/ai-manager.service';

// Rate limit AI endpoints more strictly (System Design Interview - Cap. 4)
// AI calls are expensive — 20 req/min vs 100 req/min default
@ApiTags('ai')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Throttle({ strict: { ttl: 60000, limit: 20 } })
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggestion')
  @ApiOperation({
    summary: 'Generate AI suggestion for transcript',
    description:
      'Generates a sales suggestion based on conversation transcript. ' +
      'Optionally specify a preferred AI provider (openai, claude, gemini, perplexity). ' +
      'Falls back to next available provider if chosen provider is unavailable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestion generated successfully',
    schema: {
      properties: {
        text: { type: 'string' },
        confidence: { type: 'number' },
        provider: { type: 'string' },
      },
    },
  })
  async generateSuggestion(
    @Body()
    body: {
      transcript: string;
      context?: Record<string, unknown>;
      provider?: AIProviderType;
    },
  ) {
    return this.aiService.generateSuggestion(body.transcript, body.context, body.provider);
  }

  @Post('suggestion/balanced')
  @ApiOperation({
    summary: 'Generate suggestion with load balancing',
    description:
      'Generates suggestion using round-robin provider selection for load distribution. ' +
      'Best for high-volume scenarios where provider balance matters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestion generated successfully',
  })
  async generateSuggestionBalanced(
    @Body() body: { transcript: string; context?: Record<string, unknown> },
  ) {
    return this.aiService.generateSuggestionBalanced(body.transcript, body.context);
  }

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze conversation with AI',
    description:
      'Performs deep analysis of conversation: sentiment, topics, customer intent, recommendations. ' +
      'More comprehensive than suggestion generation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis completed successfully',
  })
  async analyzeConversation(
    @Body()
    body: {
      transcript: string;
      context?: Record<string, unknown>;
      provider?: AIProviderType;
    },
  ) {
    return this.aiService.analyzeConversation(body.transcript, body.context, body.provider);
  }

  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Check AI provider health',
    description:
      'Returns health status of all configured AI providers and which ones are available. ' +
      'Public endpoint for monitoring.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
    schema: {
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        providers: { type: 'object' },
        available: { type: 'array' },
      },
    },
  })
  async healthCheck() {
    const providersHealth = await this.aiService.healthCheck();
    const availableProviders = this.aiService.getAvailableProviders();

    return {
      status: availableProviders.length > 0 ? 'ok' : 'degraded',
      providers: providersHealth,
      available: availableProviders,
    };
  }

  @Get('providers')
  @Public()
  @ApiOperation({
    summary: 'List available AI providers',
    description: 'Returns list of available and all configured AI providers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider list retrieved',
    schema: {
      properties: {
        available: { type: 'array', items: { type: 'string' } },
        all: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getProviders() {
    return {
      available: this.aiService.getAvailableProviders(),
      all: ['openai', 'claude', 'gemini', 'perplexity'],
    };
  }

  @Get('test')
  @ApiOperation({
    summary: 'Test AI suggestion generation',
    description:
      'Test endpoint that generates a sample suggestion. Requires authentication to prevent abuse.',
  })
  @ApiResponse({
    status: 200,
    description: 'Test result',
    schema: {
      properties: {
        success: { type: 'boolean' },
        result: { type: 'object' },
        error: { type: 'string' },
      },
    },
  })
  async testAI() {
    try {
      const result = await this.aiService.generateSuggestion('Customer is asking about pricing', {
        sentiment: 'neutral',
      });
      return { success: true, result };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
}
