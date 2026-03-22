import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AISuggestion, AIAnalysis } from './providers/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { PerplexityProvider } from './providers/perplexity.provider';
import { CircuitBreaker } from '../../common/resilience/circuit-breaker';

export type AIProviderType = 'openai' | 'claude' | 'gemini' | 'perplexity';

@Injectable()
export class AIManagerService {
  private readonly logger = new Logger(AIManagerService.name);
  private providers: Map<AIProviderType, AIProvider> = new Map();
  // Circuit breaker per provider (Release It! - one breaker per integration point)
  private breakers: Map<AIProviderType, CircuitBreaker> = new Map();
  private fallbackOrder: AIProviderType[] = ['gemini', 'openai', 'claude', 'perplexity'];
  private currentProviderIndex = 0;

  constructor(private configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders() {
    // OpenAI
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set('openai', new OpenAIProvider({ apiKey: openaiKey, timeout: 10000 }));
      this.logger.log('✅ OpenAI provider initialized');
    }

    // Claude
    const claudeKey = this.configService.get<string>('CLAUDE_API_KEY');
    if (claudeKey) {
      this.providers.set('claude', new ClaudeProvider({ apiKey: claudeKey, timeout: 10000 }));
      this.logger.log('✅ Claude provider initialized');
    }

    // Gemini
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.providers.set('gemini', new GeminiProvider({ apiKey: geminiKey, timeout: 10000 }));
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

    // Create circuit breaker for each provider (Release It! - Circuit Breaker)
    for (const [name] of this.providers) {
      this.breakers.set(
        name,
        new CircuitBreaker({
          name: `AI:${name}`,
          failureThreshold: 3, // 3 failures → open
          resetTimeoutMs: 30000, // 30s before half-open
          failureWindowMs: 60000, // count failures within 60s
          callTimeoutMs: 15000, // 15s timeout per call (LLM SLO: 2000ms p95, but allow headroom)
        }),
      );
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
    context?: Record<string, unknown>,
    preferredProvider?: AIProviderType,
  ): Promise<AISuggestion> {
    // Tentar provider preferido primeiro (com circuit breaker)
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const breaker = this.breakers.get(preferredProvider);
      try {
        return await (breaker
          ? breaker.execute(() =>
              this.providers.get(preferredProvider)!.generateSuggestion(transcript, context),
            )
          : this.providers.get(preferredProvider)!.generateSuggestion(transcript, context));
      } catch (error: unknown) {
        this.logger.error(
          `${preferredProvider} failed, trying fallback: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // Fallback automático (com circuit breaker por provider)
    for (const providerType of this.fallbackOrder) {
      const provider = this.providers.get(providerType);
      const breaker = this.breakers.get(providerType);
      if (!provider) continue;

      try {
        this.logger.log(`Trying provider: ${providerType}`);
        return await (breaker
          ? breaker.execute(() => provider.generateSuggestion(transcript, context))
          : provider.generateSuggestion(transcript, context));
      } catch (error: unknown) {
        this.logger.error(
          `${providerType} failed: ${error instanceof Error ? error.message : error}`,
        );
        continue;
      }
    }

    // Se todos falharam, retorna mock (graceful degradation - SRE)
    return this.getMockSuggestion(transcript);
  }

  /**
   * Analisar conversa com provider específico ou fallback
   */
  async analyzeConversation(
    transcript: string,
    context?: Record<string, unknown>,
    preferredProvider?: AIProviderType,
  ): Promise<AIAnalysis> {
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const breaker = this.breakers.get(preferredProvider);
      try {
        return await (breaker
          ? breaker.execute(() =>
              this.providers.get(preferredProvider)!.analyzeConversation(transcript, context),
            )
          : this.providers.get(preferredProvider)!.analyzeConversation(transcript, context));
      } catch (error: unknown) {
        this.logger.error(
          `${preferredProvider} analysis failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // Fallback (com circuit breaker)
    for (const providerType of this.fallbackOrder) {
      const provider = this.providers.get(providerType);
      const breaker = this.breakers.get(providerType);
      if (!provider) continue;

      try {
        return await (breaker
          ? breaker.execute(() => provider.analyzeConversation(transcript, context))
          : provider.analyzeConversation(transcript, context));
      } catch (error: unknown) {
        this.logger.error(
          `${providerType} analysis failed: ${error instanceof Error ? error.message : error}`,
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
    context?: Record<string, unknown>,
  ): Promise<AISuggestion> {
    const availableProviders = Array.from(this.providers.keys());

    if (availableProviders.length === 0) {
      return this.getMockSuggestion(transcript);
    }

    // Round-robin
    const provider = availableProviders[this.currentProviderIndex % availableProviders.length];
    this.currentProviderIndex++;

    try {
      return await this.providers.get(provider)!.generateSuggestion(transcript, context);
    } catch {
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

  /** Circuit breaker status for all providers (Release It! - expose state to ops) */
  getCircuitBreakerStatus(): Record<string, unknown> {
    const status: Record<string, unknown> = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getHealthInfo();
    }
    return status;
  }

  private getMockSuggestion(transcript: string): AISuggestion {
    return {
      text: 'Continue ouvindo ativamente e faça perguntas para entender melhor as necessidades do cliente.',
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
