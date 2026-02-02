import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIProvider,
  AISuggestion,
  AIAnalysis,
} from './providers/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { PerplexityProvider } from './providers/perplexity.provider';

export type AIProviderType = 'openai' | 'claude' | 'gemini' | 'perplexity';

@Injectable()
export class AIManagerService {
  private readonly logger = new Logger(AIManagerService.name);
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private fallbackOrder: AIProviderType[] = [
    'openai',
    'claude',
    'gemini',
    'perplexity',
  ];
  private currentProviderIndex = 0;

  constructor(private configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders() {
    // OpenAI
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set(
        'openai',
        new OpenAIProvider({ apiKey: openaiKey, timeout: 10000 }),
      );
      this.logger.log('✅ OpenAI provider initialized');
    }

    // Claude
    const claudeKey = this.configService.get<string>('CLAUDE_API_KEY');
    if (claudeKey) {
      this.providers.set(
        'claude',
        new ClaudeProvider({ apiKey: claudeKey, timeout: 10000 }),
      );
      this.logger.log('✅ Claude provider initialized');
    }

    // Gemini
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.providers.set(
        'gemini',
        new GeminiProvider({ apiKey: geminiKey, timeout: 10000 }),
      );
      this.logger.log('✅ Gemini provider initialized');
    }

    // Perplexity
    const perplexityKey = this.configService.get<string>('PERPLEXITY_API_KEY');
    if (perplexityKey) {
      this.providers.set(
        'perplexity',
        new PerplexityProvider({ apiKey: perplexityKey, timeout: 10000 }),
      );
      this.logger.log('✅ Perplexity provider initialized');
    }

    if (this.providers.size === 0) {
      this.logger.warn('⚠️ No AI providers configured - using mock mode');
    }
  }

  /**
   * Gerar sugestão com provider específico ou fallback automático
   */
  async generateSuggestion(
    transcript: string,
    context?: Record<string, any>,
    preferredProvider?: AIProviderType,
  ): Promise<AISuggestion> {
    // Tentar provider preferido primeiro
    if (preferredProvider && this.providers.has(preferredProvider)) {
      try {
        return await this.providers
          .get(preferredProvider)!
          .generateSuggestion(transcript, context);
      } catch (error) {
        this.logger.error(
          `${preferredProvider} failed, trying fallback: ${error.message}`,
        );
      }
    }

    // Fallback automático
    for (const providerType of this.fallbackOrder) {
      const provider = this.providers.get(providerType);
      if (!provider) continue;

      try {
        this.logger.log(`Trying provider: ${providerType}`);
        return await provider.generateSuggestion(transcript, context);
      } catch (error) {
        this.logger.error(`${providerType} failed: ${error.message}`);
        continue;
      }
    }

    // Se todos falharam, retorna mock
    return this.getMockSuggestion(transcript);
  }

  /**
   * Analisar conversa com provider específico ou fallback
   */
  async analyzeConversation(
    transcript: string,
    context?: Record<string, any>,
    preferredProvider?: AIProviderType,
  ): Promise<AIAnalysis> {
    if (preferredProvider && this.providers.has(preferredProvider)) {
      try {
        return await this.providers
          .get(preferredProvider)!
          .analyzeConversation(transcript, context);
      } catch (error) {
        this.logger.error(
          `${preferredProvider} analysis failed: ${error.message}`,
        );
      }
    }

    // Fallback
    for (const providerType of this.fallbackOrder) {
      const provider = this.providers.get(providerType);
      if (!provider) continue;

      try {
        return await provider.analyzeConversation(transcript, context);
      } catch (error) {
        this.logger.error(
          `${providerType} analysis failed: ${error.message}`,
        );
        continue;
      }
    }

    return this.getMockAnalysis();
  }

  /**
   * Load balancing round-robin
   */
  async generateSuggestionBalanced(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AISuggestion> {
    const availableProviders = Array.from(this.providers.keys());

    if (availableProviders.length === 0) {
      return this.getMockSuggestion(transcript);
    }

    // Round-robin
    const provider =
      availableProviders[this.currentProviderIndex % availableProviders.length];
    this.currentProviderIndex++;

    try {
      return await this.providers
        .get(provider)!
        .generateSuggestion(transcript, context);
    } catch (error) {
      this.logger.error(`Load balanced provider ${provider} failed`);
      return this.generateSuggestion(transcript, context);
    }
  }

  /**
   * Health check de todos providers
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch {
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Listar providers disponíveis
   */
  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  private getMockSuggestion(transcript: string): AISuggestion {
    return {
      text: 'Continue listening actively and ask clarifying questions about their needs.',
      confidence: 0.5,
      provider: 'mock',
      latencyMs: 0,
    };
  }

  private getMockAnalysis(): AIAnalysis {
    return {
      sentiment: 'neutral',
      keyPoints: ['Customer inquiry received'],
      suggestedActions: ['Follow up with more questions'],
      confidence: 0.5,
      provider: 'mock',
    };
  }
}