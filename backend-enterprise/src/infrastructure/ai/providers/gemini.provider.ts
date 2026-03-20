import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AISuggestion, AIAnalysis, AIProviderConfig } from './ai-provider.interface';

export class GeminiProvider extends AIProvider {
  private client: GoogleGenerativeAI;

  constructor(config: AIProviderConfig) {
    super(config, 'Gemini');
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async generateSuggestion(
    transcript: string,
    context?: Record<string, unknown>,
  ): Promise<AISuggestion> {
    const startTime = Date.now();

    const prompt = this.buildSuggestionPrompt(transcript, context);

    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-2.0-flash',
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Você é um coach de vendas especialista analisando ligações em tempo real. Responda SEMPRE em português do Brasil. Forneça UMA sugestão concisa e prática.\n\n' +
                  prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: this.config.maxTokens || 50,
          temperature: 0.3,
        },
      });

      const latencyMs = Date.now() - startTime;

      const text = result.response.text() || 'No suggestion';

      return {
        text,
        confidence: 0.87,
        provider: this.providerName,
        latencyMs,
        tokensUsed: result.response.usageMetadata?.totalTokenCount,
      };
    } catch (error: unknown) {
      throw new Error(`Gemini error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeConversation(
    transcript: string,
    context?: Record<string, unknown>,
  ): Promise<AIAnalysis> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-2.0-flash',
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Analyze this sales conversation and return ONLY valid JSON with: sentiment (positive/neutral/negative), keyPoints (array), suggestedActions (array).\n\nConversation: ${transcript}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
        },
      });

      const text = result.response.text();
      const analysis = JSON.parse(text);

      return {
        sentiment: analysis.sentiment || 'neutral',
        keyPoints: analysis.keyPoints || [],
        suggestedActions: analysis.suggestedActions || [],
        confidence: 0.83,
        provider: this.providerName,
      };
    } catch (error: unknown) {
      throw new Error(`Gemini analysis error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-2.0-flash',
      });
      await model.generateContent('test');
      return true;
    } catch (error: unknown) {
      console.error('GEMINI HEALTH ERROR:', error instanceof Error ? error.message : String(error));
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
