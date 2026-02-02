/**
 * AI Provider Interface
 * Clean Architecture: Interface abstrata para diferentes provedores de IA
 * Strategy Pattern: Permite trocar providers sem modificar código cliente
 */

export interface AISuggestion {
  text: string;
  confidence: number;
  provider: string;
  latencyMs: number;
  tokensUsed?: number;
}

export interface AIAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPoints: string[];
  suggestedActions: string[];
  confidence: number;
  provider: string;
}

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
  maxTokens?: number;
}

export abstract class AIProvider {
  protected config: AIProviderConfig;
  protected providerName: string;

  constructor(config: AIProviderConfig, providerName: string) {
    this.config = config;
    this.providerName = providerName;
  }

  /**
   * Gerar sugestão de vendas baseada em transcrição
   */
  abstract generateSuggestion(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AISuggestion>;

  /**
   * Analisar sentimento e contexto da conversa
   */
  abstract analyzeConversation(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AIAnalysis>;

  /**
   * Verificar se provider está disponível
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Nome do provider
   */
  getProviderName(): string {
    return this.providerName;
  }
}