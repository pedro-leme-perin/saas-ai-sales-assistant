import OpenAI from 'openai';
import {
  AIProvider,
  AISuggestion,
  AIAnalysis,
  AIProviderConfig,
} from './ai-provider.interface';

export class PerplexityProvider extends AIProvider {
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config, 'Perplexity');
    // Perplexity usa API compatível com OpenAI
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.perplexity.ai',
    });
  }

  async generateSuggestion(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AISuggestion> {
    const startTime = Date.now();

    const prompt = this.buildSuggestionPrompt(transcript, context);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert sales coach analyzing calls in real-time. Provide ONE concise, actionable suggestion.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: this.config.maxTokens || 150,
        temperature: 0.7,
      });

      const latencyMs = Date.now() - startTime;

      return {
        text: response.choices[0].message.content || 'No suggestion',
        confidence: 0.85,
        provider: this.providerName,
        latencyMs,
        tokensUsed: response.usage?.total_tokens,
      };
    } catch (error) {
      throw new Error(`Perplexity error: ${error.message}`);
    }
  }

  async analyzeConversation(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AIAnalysis> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content:
              'Analyze this sales conversation. Return JSON with: sentiment (positive/neutral/negative), keyPoints (array), suggestedActions (array).',
          },
          { role: 'user', content: transcript },
        ],
        max_tokens: 300,
      });

      const analysis = JSON.parse(
        response.choices[0].message.content || '{}',
      );

      return {
        sentiment: analysis.sentiment || 'neutral',
        keyPoints: analysis.keyPoints || [],
        suggestedActions: analysis.suggestedActions || [],
        confidence: 0.8,
        provider: this.providerName,
      };
    } catch (error) {
      throw new Error(`Perplexity analysis error: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.config.model || 'llama-3.1-sonar-large-128k-online',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }

  private buildSuggestionPrompt(
    transcript: string,
    context?: Record<string, any>,
  ): string {
    let prompt = `Customer said: "${transcript}"\n\n`;

    if (context?.sentiment) {
      prompt += `Customer sentiment: ${context.sentiment}\n`;
    }

    prompt += 'Provide ONE specific suggestion for the salesperson:';

    return prompt;
  }
}