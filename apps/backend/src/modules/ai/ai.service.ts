import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIManagerService,
  AIProviderType,
  RagOptions,
} from '@/infrastructure/ai/ai-manager.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiManager: AIManagerService,
  ) {
    const providers = this.aiManager.getAvailableProviders();
    if (providers.length === 0) {
      this.logger.warn('⚠️ No AI providers configured - using mock responses');
    } else {
      this.logger.log(`✅ AI Service initialized with providers: ${providers.join(', ')}`);
    }
  }

  /**
   * Gerar sugestão de vendas.
   *
   * @param transcript  Transcrição da fala do cliente
   * @param context     Contexto adicional (sentimento, histórico, etc.)
   * @param provider    Provider específico (opcional; usa fallback se não especificado)
   * @param ragOptions  RAG options: companyId para ativar retrieval, topK, minScore
   */
  async generateSuggestion(
    transcript: string,
    context?: Record<string, unknown>,
    provider?: AIProviderType,
    ragOptions?: RagOptions,
  ) {
    try {
      return await this.aiManager.generateSuggestion(transcript, context, provider, ragOptions);
    } catch (error) {
      this.logger.error('Error generating suggestion:', error);
      throw error;
    }
  }

  /**
   * Analisar conversa completa.
   *
   * @param ragOptions  RAG options: companyId para injetar contexto de knowledge base
   */
  async analyzeConversation(
    transcript: string,
    context?: Record<string, unknown>,
    provider?: AIProviderType,
    ragOptions?: RagOptions,
  ) {
    try {
      return await this.aiManager.analyzeConversation(transcript, context, provider, ragOptions);
    } catch (error) {
      this.logger.error('Error analyzing conversation:', error);
      throw error;
    }
  }

  /**
   * Gerar sugestão com load balancing (round-robin entre providers).
   *
   * @param ragOptions  RAG options: companyId para ativar retrieval
   */
  async generateSuggestionBalanced(
    transcript: string,
    context?: Record<string, unknown>,
    ragOptions?: RagOptions,
  ) {
    try {
      return await this.aiManager.generateSuggestionBalanced(transcript, context, ragOptions);
    } catch (error) {
      this.logger.error('Error in balanced suggestion:', error);
      throw error;
    }
  }

  /**
   * Health check de todos os providers
   */
  async healthCheck() {
    return await this.aiManager.healthCheckAll();
  }

  /**
   * Listar providers disponíveis
   */
  getAvailableProviders() {
    return this.aiManager.getAvailableProviders();
  }
}
