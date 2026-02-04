// Force rebuild - v2
import { Controller, Post, Get, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { Public } from '@/common/decorators/public.decorator';
import { AIProviderType } from '@/infrastructure/ai/ai-manager.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggestion')
  async generateSuggestion(
    @Body()
    body: {
      transcript: string;
      context?: Record<string, any>;
      provider?: AIProviderType;
    },
  ) {
    return this.aiService.generateSuggestion(
      body.transcript,
      body.context,
      body.provider,
    );
  }

  @Post('suggestion/balanced')
  async generateSuggestionBalanced(
    @Body() body: { transcript: string; context?: Record<string, any> },
  ) {
    return this.aiService.generateSuggestionBalanced(
      body.transcript,
      body.context,
    );
  }

  @Post('analyze')
  async analyzeConversation(
    @Body()
    body: {
      transcript: string;
      context?: Record<string, any>;
      provider?: AIProviderType;
    },
  ) {
    return this.aiService.analyzeConversation(
      body.transcript,
      body.context,
      body.provider,
    );
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
      const result = await this.aiService.generateSuggestion(
        'Customer is asking about pricing',
        { sentiment: 'neutral' },
      );
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message, stack: error.stack };
    }
  }
}