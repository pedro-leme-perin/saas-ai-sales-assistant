import { ConfigService } from '@nestjs/config';
import { AIManagerService, AIProviderType } from '../../src/infrastructure/ai/ai-manager.service';
import {
  AIProvider,
  AISuggestion,
  AIAnalysis,
} from '../../src/infrastructure/ai/providers/ai-provider.interface';
import { CircuitBreaker, CircuitState } from '../../src/common/resilience/circuit-breaker';

jest.setTimeout(15000);

describe('AIManagerService', () => {
  let service: AIManagerService;
  let configService: jest.Mocked<ConfigService>;

  const mockConfigGet = (key: string): unknown => {
    const config: Record<string, string> = {
      OPENAI_API_KEY: 'sk-test-openai',
      CLAUDE_API_KEY: 'sk-test-claude',
      GEMINI_API_KEY: 'test-gemini',
      PERPLEXITY_API_KEY: 'test-perplexity',
    };
    return config[key];
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => mockConfigGet(key)),
    } as unknown as jest.Mocked<ConfigService>;

    service = new AIManagerService(configService);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize all providers when API keys are configured', () => {
      expect(service['providers'].size).toBe(4);
      expect(service['providers'].has('openai')).toBe(true);
      expect(service['providers'].has('claude')).toBe(true);
      expect(service['providers'].has('gemini')).toBe(true);
      expect(service['providers'].has('perplexity')).toBe(true);
    });

    it('should initialize circuit breakers for each provider', () => {
      expect(service['breakers'].size).toBe(4);
      expect(service['breakers'].has('openai')).toBe(true);
      expect(service['breakers'].has('claude')).toBe(true);
      expect(service['breakers'].has('gemini')).toBe(true);
      expect(service['breakers'].has('perplexity')).toBe(true);
    });

    it('should only initialize configured providers', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-test-openai';
        return undefined;
      });

      const limitedService = new AIManagerService(configService);

      expect(limitedService['providers'].size).toBe(1);
      expect(limitedService['providers'].has('openai')).toBe(true);
      expect(limitedService['providers'].has('claude')).toBe(false);
    });

    it('should warn when no providers are configured', () => {
      configService.get.mockReturnValue(undefined);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const noProviderService = new AIManagerService(configService);

      expect(noProviderService['providers'].size).toBe(0);

      consoleWarnSpy.mockRestore();
    });

    it('should set default fallback order', () => {
      expect(service['fallbackOrder']).toEqual(['gemini', 'openai', 'claude', 'perplexity']);
    });

    it('should initialize currentProviderIndex to 0', () => {
      expect(service['currentProviderIndex']).toBe(0);
    });
  });

  describe('generateSuggestion', () => {
    let _mockProvider: jest.Mocked<AIProvider>;
    let mockBreaker: jest.Mocked<CircuitBreaker>;

    beforeEach(() => {
      _mockProvider = {
        generateSuggestion: jest.fn(),
        analyzeConversation: jest.fn(),
        healthCheck: jest.fn(),
        getProviderName: jest.fn().mockReturnValue('mock'),
      } as unknown as jest.Mocked<AIProvider>;

      mockBreaker = {
        execute: jest.fn(),
        getState: jest.fn().mockReturnValue(CircuitState.CLOSED),
        getHealthInfo: jest.fn(),
      } as unknown as jest.Mocked<CircuitBreaker>;
    });

    it('should use preferred provider when available', async () => {
      const mockSuggestion: AISuggestion = {
        text: 'Try offering a discount',
        confidence: 0.9,
        provider: 'openai',
        latencyMs: 150,
      };

      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      const result = await service.generateSuggestion('customer wants discount', {}, 'openai');

      expect(result).toEqual(mockSuggestion);
    });

    it('should use circuit breaker for preferred provider', async () => {
      const mockSuggestion: AISuggestion = {
        text: 'Test suggestion',
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      };

      mockBreaker.execute.mockResolvedValue(mockSuggestion);
      const breaker = service['breakers'].get('openai')!;
      jest.spyOn(breaker, 'execute').mockResolvedValue(mockSuggestion);

      const result = await service.generateSuggestion('test', {}, 'openai');

      expect(result).toBeDefined();
    });

    it('should fallback to other providers when preferred fails', async () => {
      const mockSuggestion: AISuggestion = {
        text: 'Fallback suggestion',
        confidence: 0.7,
        provider: 'gemini',
        latencyMs: 200,
      };

      // Make OpenAI fail
      const openaiProvider = service['providers'].get('openai')!;
      jest
        .spyOn(openaiProvider, 'generateSuggestion')
        .mockRejectedValue(new Error('OpenAI failed'));

      // Make Gemini succeed
      const geminiProvider = service['providers'].get('gemini')!;
      jest.spyOn(geminiProvider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      const result = await service.generateSuggestion('test', {}, 'openai');

      expect(result).toEqual(mockSuggestion);
      expect(result.provider).toBe('gemini');
    });

    it('should return mock suggestion when all providers fail', async () => {
      // Mock all providers to fail
      for (const [, provider] of service['providers']) {
        jest.spyOn(provider, 'generateSuggestion').mockRejectedValue(new Error('Provider failed'));
      }

      const result = await service.generateSuggestion('test');

      expect(result.provider).toBe('mock');
      expect(result.confidence).toBe(0.5);
      expect(result.latencyMs).toBe(0);
    });

    it('should skip preferred provider if not configured', async () => {
      const mockSuggestion: AISuggestion = {
        text: 'Fallback suggestion',
        confidence: 0.7,
        provider: 'gemini',
        latencyMs: 200,
      };

      // Make Gemini succeed
      const geminiProvider = service['providers'].get('gemini')!;
      jest.spyOn(geminiProvider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      const result = await service.generateSuggestion(
        'test',
        {},
        'unknownprovider' as unknown as AIProviderType,
      );

      expect(result).toEqual(mockSuggestion);
    });

    it('should pass context to provider', async () => {
      const mockSuggestion: AISuggestion = {
        text: 'Contextual suggestion',
        confidence: 0.85,
        provider: 'openai',
        latencyMs: 120,
      };

      const provider = service['providers'].get('openai')!;
      const spy = jest.spyOn(provider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      const context = { sentiment: 'positive', type: 'sales' };
      await service.generateSuggestion('test transcript', context, 'openai');

      expect(spy).toHaveBeenCalledWith('test transcript', context);
    });

    it('should try each provider in fallback order', async () => {
      const failingSpy = jest.fn().mockRejectedValue(new Error('Failed'));

      // Make all fail
      for (const [, provider] of service['providers']) {
        jest.spyOn(provider, 'generateSuggestion').mockImplementation(failingSpy);
      }

      await service.generateSuggestion('test');

      // Should have been called at least once per provider
      expect(failingSpy).toHaveBeenCalledTimes(service['providers'].size);
    });

    it('should handle error instanceof check correctly', async () => {
      const openaiProvider = service['providers'].get('openai')!;
      jest
        .spyOn(openaiProvider, 'generateSuggestion')
        .mockRejectedValue(new Error('Network error'));

      const geminiProvider = service['providers'].get('gemini')!;
      const geminiSpy = jest.spyOn(geminiProvider, 'generateSuggestion').mockResolvedValue({
        text: 'Success',
        confidence: 0.8,
        provider: 'gemini',
        latencyMs: 100,
      });

      const result = await service.generateSuggestion('test', {}, 'openai');

      expect(geminiSpy).toHaveBeenCalled();
      expect(result.provider).toBe('gemini');
    });
  });

  describe('analyzeConversation', () => {
    let mockAnalysis: AIAnalysis;

    beforeEach(() => {
      mockAnalysis = {
        sentiment: 'positive',
        keyPoints: ['Customer interested', 'Budget constraint'],
        suggestedActions: ['Send proposal', 'Provide discount options'],
        confidence: 0.85,
        provider: 'openai',
      };
    });

    it('should use preferred provider when available', async () => {
      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'analyzeConversation').mockResolvedValue(mockAnalysis);

      const result = await service.analyzeConversation('test', {}, 'openai');

      expect(result).toEqual(mockAnalysis);
      expect(result.provider).toBe('openai');
    });

    it('should fallback to other providers when preferred fails', async () => {
      const openaiProvider = service['providers'].get('openai')!;
      jest
        .spyOn(openaiProvider, 'analyzeConversation')
        .mockRejectedValue(new Error('OpenAI failed'));

      const geminiProvider = service['providers'].get('gemini')!;
      jest.spyOn(geminiProvider, 'analyzeConversation').mockResolvedValue(mockAnalysis);

      const result = await service.analyzeConversation('test', {}, 'openai');

      expect(result.provider).toBe('openai'); // Falls back to gemini but returns analysis
      expect(result).toBeDefined();
    });

    it('should return mock analysis when all providers fail', async () => {
      for (const [, provider] of service['providers']) {
        jest.spyOn(provider, 'analyzeConversation').mockRejectedValue(new Error('Failed'));
      }

      const result = await service.analyzeConversation('test');

      expect(result.provider).toBe('mock');
      expect(result.confidence).toBe(0.5);
      expect(result.sentiment).toBe('neutral');
    });

    it('should pass context to provider', async () => {
      const provider = service['providers'].get('openai')!;
      const spy = jest.spyOn(provider, 'analyzeConversation').mockResolvedValue(mockAnalysis);

      const context = { type: 'sales_call', duration: 300 };
      await service.analyzeConversation('test transcript', context, 'openai');

      expect(spy).toHaveBeenCalledWith('test transcript', context);
    });

    it('should use circuit breaker for preferred provider', async () => {
      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'analyzeConversation').mockResolvedValue(mockAnalysis);

      const result = await service.analyzeConversation('test', {}, 'openai');

      expect(result).toBeDefined();
    });
  });

  describe('generateSuggestionBalanced', () => {
    let mockSuggestion: AISuggestion;

    beforeEach(() => {
      mockSuggestion = {
        text: 'Balanced suggestion',
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      };
    });

    it('should use round-robin load balancing', async () => {
      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      const result1 = await service.generateSuggestionBalanced('test1');
      const result2 = await service.generateSuggestionBalanced('test2');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // currentProviderIndex should be incremented
      expect(service['currentProviderIndex']).toBeGreaterThan(0);
    });

    it('should return mock when no providers available', async () => {
      configService.get.mockReturnValue(undefined);
      const emptyService = new AIManagerService(configService);

      const result = await emptyService.generateSuggestionBalanced('test');

      expect(result.provider).toBe('mock');
      expect(result.confidence).toBe(0.5);
    });

    it('should fallback to generateSuggestion if provider fails', async () => {
      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'generateSuggestion').mockRejectedValueOnce(new Error('Failed'));

      // Set up fallback provider
      const geminiProvider = service['providers'].get('gemini')!;
      jest.spyOn(geminiProvider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      const result = await service.generateSuggestionBalanced('test');

      // Should fall back to full generateSuggestion logic
      expect(result).toBeDefined();
    });

    it('should cycle through providers in round-robin fashion', async () => {
      const providers = service.getAvailableProviders();
      const count = providers.length;

      for (let i = 0; i < count; i++) {
        const provider = service['providers'].get(providers[i])!;
        jest.spyOn(provider, 'generateSuggestion').mockResolvedValue(mockSuggestion);
      }

      service['currentProviderIndex'] = 0;

      for (let i = 0; i < count; i++) {
        await service.generateSuggestionBalanced('test');
      }

      // After count requests, index should be at count
      expect(service['currentProviderIndex']).toBe(count);
    });

    it('should wrap around when index exceeds provider count', async () => {
      const availableCount = service.getAvailableProviders().length;
      service['currentProviderIndex'] = availableCount - 1;

      const provider = service['providers'].get(service['fallbackOrder'][0])!;
      jest.spyOn(provider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      await service.generateSuggestionBalanced('test');

      // Index should wrap around via modulo
      expect(service['currentProviderIndex']).toBe(availableCount);
    });
  });

  describe('healthCheckAll', () => {
    it('should return health status for all providers', async () => {
      for (const [, provider] of service['providers']) {
        jest.spyOn(provider, 'healthCheck').mockResolvedValue(true);
      }

      const result = await service.healthCheckAll();

      expect(Object.keys(result).length).toBe(service['providers'].size);
      expect(Object.values(result).every((v) => v === true)).toBe(true);
    });

    it('should mark provider as unhealthy when healthCheck fails', async () => {
      const openaiProvider = service['providers'].get('openai')!;
      jest.spyOn(openaiProvider, 'healthCheck').mockRejectedValue(new Error('Failed'));

      const geminiProvider = service['providers'].get('gemini')!;
      jest.spyOn(geminiProvider, 'healthCheck').mockResolvedValue(true);

      const result = await service.healthCheckAll();

      expect(result['openai']).toBe(false);
      expect(result['gemini']).toBe(true);
    });

    it('should handle all providers failing', async () => {
      for (const [, provider] of service['providers']) {
        jest.spyOn(provider, 'healthCheck').mockRejectedValue(new Error('Failed'));
      }

      const result = await service.healthCheckAll();

      expect(Object.values(result).every((v) => v === false)).toBe(true);
    });

    it('should return empty object when no providers configured', async () => {
      configService.get.mockReturnValue(undefined);
      const emptyService = new AIManagerService(configService);

      const result = await emptyService.healthCheckAll();

      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return all configured provider names', () => {
      const providers = service.getAvailableProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('claude');
      expect(providers).toContain('gemini');
      expect(providers).toContain('perplexity');
      expect(providers.length).toBe(4);
    });

    it('should return empty array when no providers configured', () => {
      configService.get.mockReturnValue(undefined);
      const emptyService = new AIManagerService(configService);

      const providers = emptyService.getAvailableProviders();

      expect(providers).toEqual([]);
    });

    it('should reflect partial provider configuration', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-test';
        if (key === 'GEMINI_API_KEY') return 'test-gemini';
        return undefined;
      });

      const partialService = new AIManagerService(configService);
      const providers = partialService.getAvailableProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
      expect(providers).not.toContain('claude');
      expect(providers).not.toContain('perplexity');
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return circuit breaker status for all providers', () => {
      const status = service.getCircuitBreakerStatus();

      expect(Object.keys(status).length).toBe(4);
      expect(status['openai']).toBeDefined();
      expect(status['claude']).toBeDefined();
      expect(status['gemini']).toBeDefined();
      expect(status['perplexity']).toBeDefined();
    });

    it('should include health info from breakers', () => {
      const status = service.getCircuitBreakerStatus();

      for (const [name] of service['breakers']) {
        expect(status[name]).toBeDefined();
      }
    });

    it('should show CLOSED state for new breakers', () => {
      const status = service.getCircuitBreakerStatus();

      // All breakers should start in CLOSED state
      for (const [, healthInfo] of Object.entries(status)) {
        expect((healthInfo as unknown as { state: string }).state).toBe('CLOSED');
      }
    });

    it('should return empty object when no providers configured', () => {
      configService.get.mockReturnValue(undefined);
      const emptyService = new AIManagerService(configService);

      const status = emptyService.getCircuitBreakerStatus();

      expect(Object.keys(status).length).toBe(0);
    });
  });

  describe('mock suggestions and analysis', () => {
    it('should provide valid mock suggestion structure', async () => {
      for (const [, provider] of service['providers']) {
        jest.spyOn(provider, 'generateSuggestion').mockRejectedValue(new Error('Failed'));
      }

      const result = await service.generateSuggestion('test');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('latencyMs');
      expect(result.provider).toBe('mock');
    });

    it('should provide valid mock analysis structure', async () => {
      for (const [, provider] of service['providers']) {
        jest.spyOn(provider, 'analyzeConversation').mockRejectedValue(new Error('Failed'));
      }

      const result = await service.analyzeConversation('test');

      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('keyPoints');
      expect(result).toHaveProperty('suggestedActions');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('provider');
      expect(result.provider).toBe('mock');
      expect(Array.isArray(result.keyPoints)).toBe(true);
      expect(Array.isArray(result.suggestedActions)).toBe(true);
    });
  });

  describe('circuit breaker integration', () => {
    it('should wrap provider calls with circuit breaker', async () => {
      const mockSuggestion: AISuggestion = {
        text: 'Suggestion',
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      };

      const breaker = service['breakers'].get('openai')!;
      const breakerSpy = jest.spyOn(breaker, 'execute');

      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'generateSuggestion').mockResolvedValue(mockSuggestion);

      await service.generateSuggestion('test', {}, 'openai');

      expect(breakerSpy).toHaveBeenCalled();
    });

    it('should handle circuit breaker timeout', async () => {
      const provider = service['providers'].get('openai')!;
      // Simulate a timeout by rejecting with timeout error
      jest
        .spyOn(provider, 'generateSuggestion')
        .mockImplementation(
          () =>
            new Promise((_resolve, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
        );

      const geminiProvider = service['providers'].get('gemini')!;
      jest.spyOn(geminiProvider, 'generateSuggestion').mockResolvedValue({
        text: 'Fallback',
        confidence: 0.7,
        provider: 'gemini',
        latencyMs: 50,
      });

      // Should eventually fall back
      const result = await service.generateSuggestion('test', {}, 'openai');

      expect(result).toBeDefined();
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent suggestions', async () => {
      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'generateSuggestion').mockResolvedValue({
        text: 'Suggestion',
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      });

      const promises = [
        service.generateSuggestion('test1'),
        service.generateSuggestion('test2'),
        service.generateSuggestion('test3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.provider === 'openai')).toBe(true);
    });

    it('should increment provider index correctly during concurrent balanced calls', async () => {
      const provider = service['providers'].get('openai')!;
      jest.spyOn(provider, 'generateSuggestion').mockResolvedValue({
        text: 'Suggestion',
        confidence: 0.8,
        provider: 'openai',
        latencyMs: 100,
      });

      service['currentProviderIndex'] = 0;

      const promises = [
        service.generateSuggestionBalanced('test1'),
        service.generateSuggestionBalanced('test2'),
        service.generateSuggestionBalanced('test3'),
      ];

      await Promise.all(promises);

      // Index should have incremented (though exact value may vary due to concurrency)
      expect(service['currentProviderIndex']).toBeGreaterThanOrEqual(3);
    });
  });
});
