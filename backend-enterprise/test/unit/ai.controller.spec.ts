import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from '../../src/modules/ai/ai.controller';
import { AiService } from '../../src/modules/ai/ai.service';

jest.setTimeout(15000);

describe('AiController', () => {
  let controller: AiController;
  let service: {
    generateSuggestion: jest.Mock;
    generateSuggestionBalanced: jest.Mock;
    analyzeConversation: jest.Mock;
    healthCheck: jest.Mock;
    getAvailableProviders: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      generateSuggestion: jest.fn(),
      generateSuggestionBalanced: jest.fn(),
      analyzeConversation: jest.fn(),
      healthCheck: jest.fn(),
      getAvailableProviders: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: service }],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  // ─────────────────────────────────────────
  // generateSuggestion
  // ─────────────────────────────────────────

  describe('generateSuggestion', () => {
    it('should call aiService.generateSuggestion with correct params', async () => {
      const body = {
        transcript: 'Customer wants pricing info',
        context: { sentiment: 'neutral' } as Record<string, unknown>,
        provider: 'openai' as const,
      };
      service.generateSuggestion.mockResolvedValue({ suggestion: 'Offer a demo' });

      const result = await controller.generateSuggestion(body);

      expect(service.generateSuggestion).toHaveBeenCalledWith(
        body.transcript,
        body.context,
        body.provider,
      );
      expect(result).toEqual({ suggestion: 'Offer a demo' });
    });

    it('should work without optional params', async () => {
      const body = { transcript: 'Hello' };
      service.generateSuggestion.mockResolvedValue({ suggestion: 'Greet back' });

      await controller.generateSuggestion(body);

      expect(service.generateSuggestion).toHaveBeenCalledWith('Hello', undefined, undefined);
    });
  });

  // ─────────────────────────────────────────
  // generateSuggestionBalanced
  // ─────────────────────────────────────────

  describe('generateSuggestionBalanced', () => {
    it('should call aiService.generateSuggestionBalanced', async () => {
      const body = {
        transcript: 'Customer asks about pricing',
        context: { topic: 'sales' } as Record<string, unknown>,
      };
      service.generateSuggestionBalanced.mockResolvedValue({
        suggestion: 'Check our plans',
      });

      const result = await controller.generateSuggestionBalanced(body);

      expect(service.generateSuggestionBalanced).toHaveBeenCalledWith(
        body.transcript,
        body.context,
      );
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────
  // analyzeConversation
  // ─────────────────────────────────────────

  describe('analyzeConversation', () => {
    it('should call aiService.analyzeConversation', async () => {
      const body = {
        transcript: 'Long conversation transcript...',
        context: { topic: 'billing' } as Record<string, unknown>,
      };
      service.analyzeConversation.mockResolvedValue({
        sentiment: 'positive',
        score: 0.85,
      });

      const result = await controller.analyzeConversation(body);

      expect(service.analyzeConversation).toHaveBeenCalledWith(
        body.transcript,
        body.context,
        undefined,
      );
      expect(result.sentiment).toBe('positive');
    });
  });

  // ─────────────────────────────────────────
  // healthCheck
  // ─────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return ok when providers available', async () => {
      service.healthCheck.mockResolvedValue({
        openai: { state: 'CLOSED', failures: 0 },
      });
      service.getAvailableProviders.mockReturnValue(['openai', 'claude']);

      const result = await controller.healthCheck();

      expect(result.status).toBe('ok');
      expect(result.available).toEqual(['openai', 'claude']);
    });

    it('should return degraded when no providers', async () => {
      service.healthCheck.mockResolvedValue({});
      service.getAvailableProviders.mockReturnValue([]);

      const result = await controller.healthCheck();

      expect(result.status).toBe('degraded');
    });
  });

  // ─────────────────────────────────────────
  // getProviders
  // ─────────────────────────────────────────

  describe('getProviders', () => {
    it('should return available and all providers', async () => {
      service.getAvailableProviders.mockReturnValue(['openai']);

      const result = await controller.getProviders();

      expect(result.available).toEqual(['openai']);
      expect(result.all).toEqual(['openai', 'claude', 'gemini', 'perplexity']);
    });
  });

  // ─────────────────────────────────────────
  // testAI
  // ─────────────────────────────────────────

  describe('testAI', () => {
    it('should return success on successful generation', async () => {
      service.generateSuggestion.mockResolvedValue({
        suggestion: 'Test result',
      });

      const result = await controller.testAI();

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should return error on failure', async () => {
      service.generateSuggestion.mockRejectedValue(new Error('API down'));

      const result = await controller.testAI();

      expect(result.success).toBe(false);
      expect(result.error).toBe('API down');
    });
  });
});
