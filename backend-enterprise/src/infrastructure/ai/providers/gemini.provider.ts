import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProvider,
  AISuggestion,
  AIAnalysis,
  AIProviderConfig,
} from './ai-provider.interface';

export class GeminiProvider extends AIProvider {
  private client: GoogleGenerativeAI;

  constructor(config: AIProviderConfig) {
    super(config, 'Gemini');
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async generateSuggestion(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AISuggestion> {
    const startTime = Date.now();

    const prompt = this.buildSuggestionPrompt(transcript, context);

    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-pro',
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'You are an expert sales coach analyzing calls in real-time. Provide ONE concise, actionable suggestion.\n\n' +
                  prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: this.config.maxTokens || 150,
          temperature: 0.7,
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
    } catch (error: any) {
      throw new Error(`Gemini error: ${error.message}`);
    }
  }

  async analyzeConversation(
    transcript: string,
    context?: Record<string, any>,
  ): Promise<AIAnalysis> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-pro',
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
    } catch (error: any) {
      throw new Error(`Gemini analysis error: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.config.model || 'gemini-pro',
      });
      await model.generateContent('test');
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