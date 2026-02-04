import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AIProviderType } from '@/infrastructure/ai/ai-manager.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('suggestion')
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
  async generateSuggestionBalanced(
    @Body() body: { transcript: string; context?: Record<string, any> },
  ) {
    return this.aiService.generateSuggestionBalanced(
      body.transcript,
      body.context,
    );
  }

  @Post('analyze')
  @UseGuards(AuthGuard)
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
  async getProviders() {
    return {
      available: this.aiService.getAvailableProviders(),
      all: ['openai', 'claude', 'gemini', 'perplexity'],
    };
  }
}