import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../src/modules/ai/ai.service';

describe('AiService', () => {
  let service: AiService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return null; // Mock sem API key
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSuggestion', () => {
    it('should return mock suggestion when OpenAI is not configured', async () => {
      const result = await service.generateSuggestion({
        currentMessage: 'Olá, quanto custa?',
        context: 'whatsapp',
        customerSentiment: 'neutral',
      });

      expect(result).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.type).toBe('general');
    });

    it('should handle positive sentiment', async () => {
      const result = await service.generateSuggestion({
        currentMessage: 'Adorei o produto!',
        context: 'whatsapp',
        customerSentiment: 'positive',
      });

      expect(result.suggestion).toContain('interesse');
    });

    it('should handle negative sentiment', async () => {
      const result = await service.generateSuggestion({
        currentMessage: 'Muito caro!',
        context: 'whatsapp',
        customerSentiment: 'negative',
      });

      expect(result.suggestion).toContain('empatia');
    });
  });

  describe('analyzeConversation', () => {
    it('should return mock analysis when OpenAI is not configured', async () => {
      const result = await service.analyzeConversation(
        'Cliente: Olá\nVendedor: Oi, como posso ajudar?',
      );

      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.summary).toBeDefined();
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(Array.isArray(result.actionItems)).toBe(true);
    });
  });
});