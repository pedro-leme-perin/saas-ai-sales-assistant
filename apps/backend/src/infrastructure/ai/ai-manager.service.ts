import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AISuggestion, AIAnalysis } from './providers/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { PerplexityProvider } from './providers/perplexity.provider';
import { CircuitBreaker } from '../../common/resilience/circuit-breaker';
// KnowledgeBaseService is injected via the KNOWLEDGE_BASE_SERVICE token (optional).
// AiModule must add { provide: KNOWLEDGE_BASE_SERVICE, useExisting: KnowledgeBaseService }
// to its providers array to wire the RAG pipeline.
// Using a token avoids a circular import between infrastructure/ and modules/.
import type { KnowledgeBaseService } from '../../modules/knowledge-base/knowledge-base.service';

export type AIProviderType = 'openai' | 'claude' | 'gemini' | 'perplexity';

/** Injection token for optional KnowledgeBaseService (avoids circular dep) */
export const KNOWLEDGE_BASE_SERVICE = 'KNOWLEDGE_BASE_SERVICE' as const;

// RAG options passed per-call to control context injection
export interface RagOptions {
  /** Company ID for tenant-scoped knowledge retrieval */
  companyId?: string;
  /** Number of relevant chunks to inject (default: 5) */
  topK?: number;
  /** Minimum cosine similarity threshold (default: 0.7) */
  minScore?: number;
  /** Whether to skip RAG even if KnowledgeBaseService is available */
  skipRag?: boolean;
}

@Injectable()
export class AIManagerService {
  private readonly logger = new Logger(AIManagerService.name);
  private providers: Map<AIProviderType, AIProvider> = new Map();
  // Circuit breaker per provider (Release It! - one breaker per integration point)
  private breakers: Map<AIProviderType, CircuitBreaker> = new Map();
  private fallbackOrder: AIProviderType[] = ['gemini', 'openai', 'claude', 'perplexity'];
  private currentProviderIndex = 0;

  constructor(
    private configService: ConfigService,
    // Optional: injected when AiModule wires KnowledgeBaseModule.
    // When not present, RAG is silently skipped (graceful degradation).
    @Optional() @Inject(KNOWLEDGE_BASE_SERVICE)
    private readonly knowledgeBase: KnowledgeBaseService | null,
  ) {
    this.initializeProviders();
    if (this.knowledgeBase) {
      this.logger.log('✅ RAG pipeline enabled (KnowledgeBaseService injected)');
    } else {
      this.logger.log('ℹ️  RAG pipeline disabled (KnowledgeBaseService not wired)');
    }
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

  // ==========================================
  // RAG CONTEXT INJECTION
  // ==========================================

  /**
   * Retrieve relevant knowledge chunks and build a context string for injection
   * into the system prompt. Returns empty string if RAG is unavailable or fails.
   *
   * Graceful degradation: any error here MUST NOT block the LLM call.
   * The LLM runs with less context rather than failing entirely.
   * (SRE — fail open for non-critical path; Designing ML Systems — retrieval augmentation)
   */
  private async buildRagContext(
    query: string,
    ragOptions?: RagOptions,
  ): Promise<string> {
    if (!this.knowledgeBase) return '';
    if (ragOptions?.skipRag) return '';
    if (!ragOptions?.companyId) return '';

    try {
      const chunks = await this.knowledgeBase.findRelevant(
        ragOptions.companyId,
        query,
        ragOptions.topK ?? 5,
        ragOptions.minScore ?? 0.7,
      );

      if (chunks.length === 0) return '';

      const contextStr = this.knowledgeBase.buildContextString(chunks);
      this.logger.debug(
        `RAG: injected ${chunks.length} chunks for companyId=${ragOptions.companyId}`,
      );
      return contextStr;
    } catch (error: unknown) {
      // Log and degrade — never let RAG failure block a suggestion
      this.logger.warn(
        `RAG context retrieval failed (non-blocking): ${error instanceof Error ? error.message : String(error)}`,
      );
      return '';
    }
  }

  /**
   * Merge RAG context into the context map passed to providers.
   * Providers read context.ragContext and prepend it to the system prompt.
   */
  private mergeRagIntoContext(
    context: Record<string, unknown> | undefined,
    ragContext: string,
  ): Record<string, unknown> {
    if (!ragContext) return context ?? {};
    return { ...(context ?? {}), ragContext };
  }

  // ==========================================
  // SUGGESTION GENERATION
  // ==========================================

  /**
   * Gerar sugestão com provider específico ou fallback automático.
   *
   * RAG pipeline (when companyId is provided via ragOptions):
   *   1. Embed `transcript` via KnowledgeBaseService.findRelevant()
   *   2. Inject top-k chunks as ragContext into provider system prompt
   *   3. LLM generates suggestion grounded in company knowledge
   *
   * RAG is fire-and-forget on failure: if retrieval errors, the LLM call
   * still proceeds without context (graceful degradation — SRE).
   */
  async generateSuggestion(
    transcript: string,
    context?: Record<string, unknown>,
    preferredProvider?: AIProviderType,
    ragOptions?: RagOptions,
  ): Promise<AISuggestion> {
    // RAG: retrieve context (non-blocking failure)
    const ragContext = await this.buildRagContext(transcript, ragOptions);
    const enrichedContext = this.mergeRagIntoContext(context, ragContext);

    // Tentar provider preferido primeiro (com circuit breaker)
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const breaker = this.breakers.get(preferredProvider);
      try {
        return await (breaker
          ? breaker.execute(() =>
              this.providers.get(preferredProvider)!.generateSuggestion(transcript, enrichedContext),
            )
          : this.providers.get(preferredProvider)!.generateSuggestion(transcript, enrichedContext));
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
          ? breaker.execute(() => provider.generateSuggestion(transcript, enrichedContext))
          : provider.generateSuggestion(transcript, enrichedContext));
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
   * Analisar conversa com provider específico ou fallback.
   * RAG context also injected here — relevant knowledge improves analysis accuracy.
   */
  async analyzeConversation(
    transcript: string,
    context?: Record<string, unknown>,
    preferredProvider?: AIProviderType,
    ragOptions?: RagOptions,
  ): Promise<AIAnalysis> {
    const ragContext = await this.buildRagContext(transcript, ragOptions);
    const enrichedContext = this.mergeRagIntoContext(context, ragContext);

    if (preferredProvider && this.providers.has(preferredProvider)) {
      const breaker = this.breakers.get(preferredProvider);
      try {
        return await (breaker
          ? breaker.execute(() =>
              this.providers.get(preferredProvider)!.analyzeConversation(transcript, enrichedContext),
            )
          : this.providers.get(preferredProvider)!.analyzeConversation(transcript, enrichedContext));
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
          ? breaker.execute(() => provider.analyzeConversation(transcript, enrichedContext))
          : provider.analyzeConversation(transcript, enrichedContext));
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
   * Load balancing round-robin.
   * RAG context injected when ragOptions.companyId is provided.
   */
  async generateSuggestionBalanced(
    transcript: string,
    context?: Record<string, unknown>,
    ragOptions?: RagOptions,
  ): Promise<AISuggestion> {
    const availableProviders = Array.from(this.providers.keys());

    if (availableProviders.length === 0) {
      return this.getMockSuggestion(transcript);
    }

    const ragContext = await this.buildRagContext(transcript, ragOptions);
    const enrichedContext = this.mergeRagIntoContext(context, ragContext);

    // Round-robin
    const provider = availableProviders[this.currentProviderIndex % availableProviders.length];
    this.currentProviderIndex++;

    try {
      return await this.providers.get(provider)!.generateSuggestion(transcript, enrichedContext);
    } catch {
      this.logger.error(`Load balanced provider ${provider} failed`);
      return this.generateSuggestion(transcript, enrichedContext);
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

  private getMockSuggestion(_transcript: string): AISuggestion {
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
