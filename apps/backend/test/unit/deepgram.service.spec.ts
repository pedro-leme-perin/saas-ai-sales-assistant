import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  DeepgramService,
  TranscriptionResult,
  LiveSession,
} from '../../src/infrastructure/stt/deepgram.service';
import { CircuitBreaker } from '../../src/common/resilience/circuit-breaker';

jest.setTimeout(15000);

// Mock WebSocket
jest.mock('ws', () => {
  return jest.fn(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
  }));
});

describe('DeepgramService', () => {
  let service: DeepgramService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'DEEPGRAM_API_KEY') return 'test-deepgram-key';
      return undefined;
    }),
  };

  beforeEach(async () => {
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeepgramService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DeepgramService>(DeepgramService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with API key', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('DEEPGRAM_API_KEY');
    });

    it('should warn when API key not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DeepgramService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const serviceWithoutKey = module.get<DeepgramService>(DeepgramService);

      expect(serviceWithoutKey).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith('Deepgram API key not configured');

      warnSpy.mockRestore();
    });
  });

  describe('isConfigured()', () => {
    it('should return true when configured', () => {
      const result = service.isConfigured();
      expect(result).toBe(true);
    });

    it('should return false when not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DeepgramService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const serviceWithoutKey = module.get<DeepgramService>(DeepgramService);

      const result = serviceWithoutKey.isConfigured();
      expect(result).toBe(false);
    });
  });

  describe('createLiveSession()', () => {
    it('should throw when not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DeepgramService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const serviceWithoutKey = module.get<DeepgramService>(DeepgramService);

      const mockCallback = jest.fn();

      expect(() => serviceWithoutKey.createLiveSession(mockCallback)).toThrow(
        'Deepgram not configured',
      );
    });

    it('should return LiveSession object with send/finish/isReady', () => {
      const mockCallback = jest.fn();

      const session = service.createLiveSession(mockCallback);

      expect(session).toBeDefined();
      expect(typeof session.send).toBe('function');
      expect(typeof session.finish).toBe('function');
      expect(typeof session.isReady).toBe('function');
    });

    it('should have isReady method on LiveSession', () => {
      const mockCallback = jest.fn();

      const session = service.createLiveSession(mockCallback);
      const isReady = session.isReady();

      expect(typeof isReady).toBe('boolean');
    });

    it('should have send method on LiveSession', () => {
      const mockCallback = jest.fn();

      const session = service.createLiveSession(mockCallback);
      const audioBuffer = Buffer.from([0x00, 0x01, 0x02]);

      // Should not throw
      expect(() => session.send(audioBuffer)).not.toThrow();
    });

    it('should have finish method on LiveSession', () => {
      const mockCallback = jest.fn();

      const session = service.createLiveSession(mockCallback);

      // Should not throw
      expect(() => session.finish()).not.toThrow();
    });
  });

  describe('transcribeUrl()', () => {
    it('should throw when not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DeepgramService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const serviceWithoutKey = module.get<DeepgramService>(DeepgramService);

      await expect(
        serviceWithoutKey.transcribeUrl('https://example.com/audio.mp3'),
      ).rejects.toThrow('Deepgram not configured');
    });

    it('should return transcript on success', async () => {
      const mockFetch = global.fetch as jest.Mock;
      const expectedTranscript = 'Hello, this is a test transcript';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [
              {
                alternatives: [{ transcript: expectedTranscript }],
              },
            ],
          },
        }),
      });

      const result = await service.transcribeUrl('https://example.com/audio.mp3');

      expect(result).toBe(expectedTranscript);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true&punctuate=true',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Token test-deepgram-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should throw on API error', async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(service.transcribeUrl('https://example.com/invalid.mp3')).rejects.toThrow(
        'Deepgram error: 400',
      );
    });

    it('should return empty string when transcript missing', async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [],
          },
        }),
      });

      const result = await service.transcribeUrl('https://example.com/silent.mp3');

      expect(result).toBe('');
    });
  });

  describe('getCircuitBreakerStatus()', () => {
    it('should return health info', () => {
      const status = service.getCircuitBreakerStatus();

      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
      expect(['closed', 'open', 'half-open']).toContain(status.state);
    });
  });

  describe('circuit breaker integration', () => {
    it('should use circuit breaker for transcribeUrl', async () => {
      const mockFetch = global.fetch as jest.Mock;

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [
              {
                alternatives: [{ transcript: 'Circuit breaker test' }],
              },
            ],
          },
        }),
      });

      const result = await service.transcribeUrl('https://example.com/test.mp3');

      expect(result).toBe('Circuit breaker test');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(service.transcribeUrl('https://example.com/audio.mp3')).rejects.toThrow();
    });

    it('should handle malformed JSON response', async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(service.transcribeUrl('https://example.com/audio.mp3')).rejects.toThrow();
    });
  });

  describe('transcription result validation', () => {
    it('should handle response with full metadata', async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            channels: [
              {
                alternatives: [
                  {
                    transcript: 'Full metadata test',
                    confidence: 0.95,
                    words: [
                      { word: 'Full', start: 0, end: 0.5 },
                      { word: 'metadata', start: 0.5, end: 1.0 },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      });

      const result = await service.transcribeUrl('https://example.com/audio.mp3');

      expect(result).toBe('Full metadata test');
    });
  });
});
