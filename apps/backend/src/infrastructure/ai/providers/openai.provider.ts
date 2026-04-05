import OpenAI from 'openai';
import { AIProvider, AISuggestion, AIAnalysis, AIProviderConfig } from './ai-provider.interface';

export class OpenAIProvider extends AIProvider {
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config, 'OpenAI');
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async generateSuggestion(
    transcript: string,
    context?: Record<string, unknown>,
  ): Promise<AISuggestion> {
    const startTime = Date.now();

    const prompt = this.buildSuggestionPrompt(transcript, context);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Você é um coach de vendas especialista analisando ligações em tempo real. Responda SEMPRE em português do Brasil. Forneça UMA sugestão concisa e prática.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: this.config.maxTokens || 150,
        temperature: 0.7,
      });

      const latencyMs = Date.now() - startTime;

      return {
        text: response.choices[0].message.content || 'No suggestion',
        confidence: 0.9,
        provider: this.providerName,
        latencyMs,
        tokensUsed: response.usage?.total_tokens,
      };
    } catch (error: unknown) {
      throw new Error(`OpenAI error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeConversation(
    transcript: string,
    _context?: Record<string, unknown>,
  ): Promise<AIAnalysis> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Analyze this sales conversation. Return JSON with: sentiment (positive/neutral/negative), keyPoints (array), suggestedActions (array).',
          },
          { role: 'user', content: transcript },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        sentiment: analysis.sentiment || 'neutral',
        keyPoints: analysis.keyPoints || [],
        suggestedActions: analysis.suggestedActions || [],
        confidence: 0.85,
        provider: this.providerName,
      };
    } catch (error: unknown) {
      throw new Error(
        `OpenAI analysis error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error: unknown) {
      console.error('OPENAI HEALTH ERROR:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private buildSuggestionPrompt(transcript: string, context?: Record<string, unknown>): string {
    let prompt = `Customer said: "${transcript}"\n\n`;

    if (context?.sentiment) {
      prompt += `Customer sentiment: ${context.sentiment}\n`;
    }

    prompt += 'Forneça UMA sugestão específica para o vendedor em português do Brasil:';

    return prompt;
  }
}
