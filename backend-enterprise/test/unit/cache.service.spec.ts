import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CacheService } from '../../src/infrastructure/cache/cache.service';

jest.setTimeout(10000);

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'UPSTASH_REDIS_REST_URL') return 'https://redis.example.com';
      if (key === 'UPSTASH_REDIS_REST_TOKEN') return 'test-token-123';
      return undefined;
    }),
  };

  beforeEach(async () => {
    // Mock global fetch
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with configured credentials', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('UPSTASH_REDIS_REST_URL');
      expect(configService.get).toHaveBeenCalledWith('UPSTASH_REDIS_REST_TOKEN');
    });

    it('should warn when credentials not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const serviceWithoutCreds = module.get<CacheService>(CacheService);

      expect(serviceWithoutCreds).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith('Redis credentials not configured - using mock cache');

      warnSpy.mockRestore();
    });
  });

  describe('get()', () => {
    it('should return cached value', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'cached-value' }),
      });

      const result = await service.get('test-key');

      expect(result).toBe('cached-value');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://redis.example.com',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        }),
      );
    });

    it('should return null when not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const serviceWithoutCreds = module.get<CacheService>(CacheService);

      const result = await serviceWithoutCreds.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('should set value with TTL', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'OK' }),
      });

      const result = await service.set('test-key', 'test-value', 3600);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://redis.example.com',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(['SETEX', 'test-key', '3600', 'test-value']),
        }),
      );
    });

    it('should set value without TTL', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'OK' }),
      });

      const result = await service.set('test-key', 'test-value');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://redis.example.com',
        expect.objectContaining({
          body: JSON.stringify(['SET', 'test-key', 'test-value']),
        }),
      );
    });
  });

  describe('delete()', () => {
    it('should delete key', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      });

      const result = await service.delete('test-key');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://redis.example.com',
        expect.objectContaining({
          body: JSON.stringify(['DEL', 'test-key']),
        }),
      );
    });
  });

  describe('exists()', () => {
    it('should return true when key exists', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      });

      const result = await service.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 0 }),
      });

      const result = await service.exists('nonexistent-key');

      expect(result).toBe(false);
    });
  });

  describe('getJson()', () => {
    it('should parse JSON correctly', async () => {
      const mockFetch = global.fetch as jest.Mock;
      const jsonData = { user: 'john', email: 'john@example.com' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: JSON.stringify(jsonData) }),
      });

      const result = await service.getJson('user-data');

      expect(result).toEqual(jsonData);
    });

    it('should return null on parse error', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'invalid-json-{' }),
      });

      const result = await service.getJson('invalid-key');

      expect(result).toBeNull();
    });
  });

  describe('healthCheck()', () => {
    it('should return healthy with PONG', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'PONG' }),
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.circuitBreaker).toBe('closed');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return not_configured when no credentials', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const serviceWithoutCreds = module.get<CacheService>(CacheService);

      const result = await serviceWithoutCreds.healthCheck();

      expect(result.status).toBe('not_configured');
      expect(result.circuitBreaker).toBe('closed');
      expect(result.latency).toBeUndefined();
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit breaker after 3 consecutive failures', async () => {
      const mockFetch = global.fetch as jest.Mock;

      // First 3 failures
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });
      }

      // Attempt 3 calls that will fail
      await service.get('key1');
      await service.get('key2');
      await service.get('key3');

      // Fourth call should return null immediately (circuit open)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'should-not-be-called' }),
      });

      const result = await service.get('key4');

      expect(result).toBeNull();
    });

    it('should return null when circuit is open', async () => {
      const mockFetch = global.fetch as jest.Mock;

      // Trigger circuit breaker to open
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });
      }

      await service.get('key1');
      await service.get('key2');
      await service.get('key3');

      // Circuit should be open now
      const result = await service.get('key4');

      expect(result).toBeNull();
    });
  });

  describe('checkRateLimit()', () => {
    it('should allow when under limit', async () => {
      const mockFetch = global.fetch as jest.Mock;

      // Mock for ZREMRANGEBYSCORE
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 0 }),
      });

      // Mock for ZCARD
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 0 }),
      });

      // Mock for ZADD
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      });

      // Mock for EXPIRE
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      });

      const result = await service.checkRateLimit('rate:user:123', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should block when over limit', async () => {
      const mockFetch = global.fetch as jest.Mock;

      // Mock for ZREMRANGEBYSCORE
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 0 }),
      });

      // Mock for ZCARD returning maxRequests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 10 }),
      });

      const result = await service.checkRateLimit('rate:user:456', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('session helpers', () => {
    it('should setSession with TTL', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'OK' }),
      });

      const sessionData = { userId: 'user-123', role: 'VENDOR' };
      const result = await service.setSession('session-abc', sessionData, 1800);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should getSession and parse JSON', async () => {
      const mockFetch = global.fetch as jest.Mock;
      const sessionData = { userId: 'user-456', role: 'ADMIN' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: JSON.stringify(sessionData) }),
      });

      const result = await service.getSession('session-xyz');

      expect(result).toEqual(sessionData);
    });

    it('should deleteSession', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      });

      const result = await service.deleteSession('session-delete');

      expect(result).toBe(true);
    });
  });

  describe('key generators', () => {
    it('should generate company key', () => {
      const key = service.companyKey('company-123');
      expect(key).toBe('company:company-123');
    });

    it('should generate user key', () => {
      const key = service.userKey('user-456');
      expect(key).toBe('user:user-456');
    });

    it('should generate AI suggestion key', () => {
      const key = service.aiSuggestionKey('hash-789');
      expect(key).toBe('ai:suggestion:hash-789');
    });

    it('should generate session key', () => {
      const key = service.sessionKey('session-abc');
      expect(key).toBe('session:session-abc');
    });
  });
});
