import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../src/modules/ai/ai.service';
import { AIManagerService } from '../../src/infrastructure/ai/ai-manager.service';

describe('AiService', () => {
  let service: AiService;
  let aiManager: AIManagerService;

  const mockAIManagerService = {
    generateSuggestion: jest.fn(),
    analyzeConversation: jest.fn(),
    healthCheckAll: jest.fn(),
    getAvailableProviders: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: AIManagerService,
          useValue: mockAIManagerService,
        },
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
    aiManager = module.get<AIManagerService>(AIManagerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSuggestion', () => {
    it('should generate a suggestion via AIManager', async () => {
      const mockResponse = {
        text: 'I recommend offering a 10% discount for annual plans.',
        provider: 'openai',
        confidence: 0.85,
      };
      mockAIManagerService.generateSuggestion.mockResolvedValue(mockResponse);

      const result = await service.generateSuggestion('Customer is asking about pricing', {
        sentiment: 'neutral',
      });

      expect(result).toBeDefined();
      expect(result.text).toBe(mockResponse.text);
      expect(result.provider).toBe('openai');
      expect(result.confidence).toBe(0.85);
      expect(mockAIManagerService.generateSuggestion).toHaveBeenCalled();
    });

    it('should handle error from AIManager gracefully', async () => {
      mockAIManagerService.generateSuggestion.mockRejectedValue(new Error('All providers failed'));

      await expect(service.generateSuggestion('test', {})).rejects.toThrow('All providers failed');
    });
  });

  describe('analyzeConversation', () => {
    it('should analyze conversation via AIManager', async () => {
      const mockAnalysis = {
        sentiment: 'positive',
        keyPoints: ['Customer is satisfied', 'Interested in upsell'],
        suggestedActions: ['Propose premium plan'],
      };
      mockAIManagerService.analyzeConversation.mockResolvedValue(mockAnalysis);

      const result = await service.analyzeConversation(
        'Customer is very happy with the product',
        {},
      );

      expect(result).toBeDefined();
      expect(result.sentiment).toBe('positive');
      expect(result.keyPoints).toHaveLength(2);
      expect(result.suggestedActions).toHaveLength(1);
    });

    it('should handle analysis failure', async () => {
      mockAIManagerService.analyzeConversation.mockRejectedValue(new Error('Analysis failed'));

      await expect(service.analyzeConversation('test', {})).rejects.toThrow('Analysis failed');
    });
  });

  describe('healthCheck', () => {
    it('should return health status from all providers', async () => {
      const mockHealth = { openai: true };
      mockAIManagerService.healthCheckAll.mockResolvedValue(mockHealth);

      const result = await service.healthCheck();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers list', () => {
      mockAIManagerService.getAvailableProviders.mockReturnValue(['openai']);

      const result = service.getAvailableProviders();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('openai');
    });

    it('should return empty array when no providers configured', () => {
      mockAIManagerService.getAvailableProviders.mockReturnValue([]);

      const result = service.getAvailableProviders();

      expect(result).toHaveLength(0);
    });
  });
});
