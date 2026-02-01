import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface SuggestionRequest {
  currentMessage: string;
  conversationHistory?: string;
  context?: 'phone_call' | 'whatsapp';
  customerSentiment?: 'positive' | 'neutral' | 'negative';
  productContext?: string;
}

export interface SuggestionResponse {
  suggestion: string;
  confidence: number;
  type: string;
  context?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('✅ OpenAI client initialized');
    } else {
      this.logger.warn('⚠️ OpenAI API key not configured - using mock responses');
    }
  }

  async generateSuggestion(request: SuggestionRequest): Promise<SuggestionResponse> {
    this.logger.debug('Generating AI suggestion');

    if (!this.openai) {
      return this.getMockSuggestion(request);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(request.context);
      const userPrompt = this.buildUserPrompt(request);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const suggestion = response.choices[0]?.message?.content?.trim() || '';

      return {
        suggestion,
        confidence: 0.9,
        type: this.detectSuggestionType(suggestion),
        context: request.context,
      };
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      return this.getMockSuggestion(request);
    }
  }

  async analyzeConversation(transcript: string): Promise<{
    sentiment: string;
    score: number;
    summary: string;
    keywords: string[];
    actionItems: string[];
  }> {
    this.logger.debug('Analyzing conversation');

    if (!this.openai) {
      return this.getMockAnalysis();
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um analista de vendas especializado. Analise a conversa e retorne um JSON com:
- sentiment: "positive", "neutral" ou "negative"
- score: número de 0 a 1 indicando intensidade do sentimento
- summary: resumo de 1-2 frases da conversa
- keywords: array com 3-5 palavras-chave importantes
- actionItems: array com 1-3 próximos passos recomendados

Responda APENAS com o JSON, sem markdown.`,
          },
          { role: 'user', content: transcript },
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content?.trim() || '{}';
      
      try {
        return JSON.parse(content);
      } catch {
        return this.getMockAnalysis();
      }
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      return this.getMockAnalysis();
    }
  }

  private buildSystemPrompt(context?: string): string {
    const basePrompt = `Você é um assistente de vendas experiente que ajuda vendedores em tempo real.
Suas sugestões devem ser:
- Curtas e diretas (máximo 2 frases)
- Específicas para a situação
- Em português brasileiro
- Focadas em avançar a venda ou resolver objeções`;

    if (context === 'phone_call') {
      return `${basePrompt}

Contexto: Ligação telefônica de vendas.
Foque em: tom de voz, pausas estratégicas, perguntas abertas.`;
    }

    if (context === 'whatsapp') {
      return `${basePrompt}

Contexto: Conversa no WhatsApp Business.
Foque em: respostas rápidas, emojis moderados, links úteis.`;
    }

    return basePrompt;
  }

  private buildUserPrompt(request: SuggestionRequest): string {
    let prompt = `Mensagem do cliente: "${request.currentMessage}"`;

    if (request.conversationHistory) {
      prompt = `Histórico da conversa:\n${request.conversationHistory}\n\n${prompt}`;
    }

    if (request.customerSentiment) {
      prompt += `\n\nSentimento detectado: ${request.customerSentiment}`;
    }

    if (request.productContext) {
      prompt += `\n\nProduto/Serviço: ${request.productContext}`;
    }

    prompt += '\n\nSugira uma resposta para o vendedor:';

    return prompt;
  }

  private detectSuggestionType(suggestion: string): string {
    const lower = suggestion.toLowerCase();
    
    if (lower.includes('objeção') || lower.includes('entendo sua preocupação')) {
      return 'objection_handling';
    }
    if (lower.includes('fechar') || lower.includes('próximo passo')) {
      return 'closing';
    }
    if (lower.includes('?')) {
      return 'question';
    }
    return 'general';
  }

  private getMockSuggestion(request: SuggestionRequest): SuggestionResponse {
    const suggestions = {
      positive: 'Ótimo! Aproveite o interesse do cliente e apresente os benefícios principais do produto.',
      neutral: 'Faça uma pergunta aberta para entender melhor as necessidades do cliente.',
      negative: 'Demonstre empatia e pergunte o que poderia ser feito para atender melhor às expectativas.',
    };

    return {
      suggestion: suggestions[request.customerSentiment || 'neutral'],
      confidence: 0.7,
      type: 'general',
      context: request.context,
    };
  }

  private getMockAnalysis() {
    return {
      sentiment: 'neutral',
      score: 0.5,
      summary: 'Conversa em andamento, cliente demonstra interesse moderado.',
      keywords: ['produto', 'preço', 'interesse'],
      actionItems: ['Apresentar benefícios', 'Enviar proposta'],
    };
  }
}