import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  AISuggestion,
  AIAnalysis,
  AIProviderConfig,
} from './ai-provider.interface';

export class ClaudeProvider extends AIProvider {
  private client: Anthropic;

  constructor(config: AIProviderConfig) {
    super(config, 'Claude');
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async generateSuggestion(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AISuggestion> {
    const startTime = Date.now();

    const prompt = this.buildSuggestionPrompt(transcript, context);

    try {
      const response = await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: this.config.maxTokens || 150,
        messages: [{ role: 'user', content: prompt }],
        system:
          'You are an expert sales coach analyzing calls in real-time. Provide ONE concise, actionable suggestion.',
      });

      const latencyMs = Date.now() - startTime;

      const text =
        response.content[0].type === 'text'
          ? response.content[0].text
          : 'No suggestion';

      return {
        text,
        confidence: 0.92,
        provider: this.providerName,
        latencyMs,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error) {
      throw new Error(`Claude error: ${error.message}`);
    }
  }

  async analyzeConversation(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AIAnalysis> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Analyze this sales conversation and return ONLY valid JSON with: sentiment (positive/neutral/negative), keyPoints (array), suggestedActions (array).\n\nConversation: ${transcript}`,
          },
        ],
      });

      const text =
        response.content[0].type === 'text'
          ? response.content[0].text
          : '{}';

      const analysis = JSON.parse(text);

      return {
        sentiment: analysis.sentiment || 'neutral',
        keyPoints: analysis.keyPoints || [],
        suggestedActions: analysis.suggestedActions || [],
        confidence: 0.88,
        provider: this.providerName,
      };
    } catch (error) {
      throw new Error(`Claude analysis error: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
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