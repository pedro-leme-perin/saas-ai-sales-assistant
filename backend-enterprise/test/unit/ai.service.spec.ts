import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../src/modules/ai/ai.service';
import { AIManagerService } from '../../src/infrastructure/ai/ai-manager.service';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        AIManagerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return 'test-key';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSuggestion', () => {
    it('should generate a suggestion', async () => {
      const result = await service.generateSuggestion(
        'Customer is asking about pricing',
        { sentiment: 'neutral' },
      );

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.provider).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('analyzeConversation', () => {
    it('should analyze conversation', async () => {
      const result = await service.analyzeConversation(
        'Customer is very happy with the product',
        {},
      );

      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(Array.isArray(result.keyPoints)).toBe(true);
      expect(Array.isArray(result.suggestedActions)).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await service.healthCheck();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers', () => {
      const result = service.getAvailableProviders();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});