// Force rebuild - v2
import { Controller, Post, Get, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { Public } from '@/common/decorators/public.decorator';
import { AIProviderType } from '@/infrastructure/ai/ai-manager.service';

// Rate limit AI endpoints more strictly (System Design Interview - Cap. 4)
// AI calls are expensive — 20 req/min vs 100 req/min default
@Throttle({ strict: { ttl: 60000, limit: 20 } })
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggestion')
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
  async generateSuggestionBalanced(
    @Body() body: { transcript: string; context?: Record<string, unknown> },
  ) {
    return this.aiService.generateSuggestionBalanced(body.transcript, body.context);
  }

  @Post('analyze')
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
  async getProviders() {
    return {
      available: this.aiService.getAvailableProviders(),
      all: ['openai', 'claude', 'gemini', 'perplexity'],
    };
  }

  @Get('test')
  @Public()
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
