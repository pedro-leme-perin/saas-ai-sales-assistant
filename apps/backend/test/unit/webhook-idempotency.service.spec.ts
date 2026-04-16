import { Test, TestingModule } from '@nestjs/testing';
import { WebhookIdempotencyService } from '../../src/common/resilience/webhook-idempotency.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';

describe('WebhookIdempotencyService', () => {
  let service: WebhookIdempotencyService;
  let cacheService: {
    exists: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(async () => {
    cacheService = {
      exists: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookIdempotencyService,
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<WebhookIdempotencyService>(WebhookIdempotencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndMark', () => {
    it('should return isDuplicate=false for new event', async () => {
      cacheService.exists.mockResolvedValue(false);
      cacheService.set.mockResolvedValue(true);

      const result = await service.checkAndMark('stripe', 'evt_123');

      expect(result.isDuplicate).toBe(false);
      expect(result.correlationId).toBe('wh_stripe_evt_123');
      expect(cacheService.exists).toHaveBeenCalledWith('webhook:dedup:stripe:evt_123');
      expect(cacheService.set).toHaveBeenCalledWith(
        'webhook:dedup:stripe:evt_123',
        expect.objectContaining({ source: 'stripe' }),
        48 * 60 * 60,
      );
    });

    it('should return isDuplicate=true for already processed event', async () => {
      cacheService.exists.mockResolvedValue(true);

      const result = await service.checkAndMark('stripe', 'evt_123');

      expect(result.isDuplicate).toBe(true);
      expect(result.correlationId).toBe('wh_stripe_evt_123');
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should use correct key prefix for each source', async () => {
      cacheService.exists.mockResolvedValue(false);
      cacheService.set.mockResolvedValue(true);

      await service.checkAndMark('clerk', 'svix_abc');
      expect(cacheService.exists).toHaveBeenCalledWith('webhook:dedup:clerk:svix_abc');

      await service.checkAndMark('whatsapp', 'wamid_xyz');
      expect(cacheService.exists).toHaveBeenCalledWith('webhook:dedup:whatsapp:wamid_xyz');
    });

    it('should use custom TTL when provided', async () => {
      cacheService.exists.mockResolvedValue(false);
      cacheService.set.mockResolvedValue(true);

      await service.checkAndMark('stripe', 'evt_456', 3600);

      expect(cacheService.set).toHaveBeenCalledWith(
        'webhook:dedup:stripe:evt_456',
        expect.any(Object),
        3600,
      );
    });

    it('should allow processing on Redis failure (graceful degradation)', async () => {
      cacheService.exists.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.checkAndMark('stripe', 'evt_789');

      expect(result.isDuplicate).toBe(false);
      expect(result.correlationId).toBe('wh_stripe_evt_789');
    });

    it('should generate correct correlationId format', async () => {
      cacheService.exists.mockResolvedValue(false);
      cacheService.set.mockResolvedValue(true);

      const stripeResult = await service.checkAndMark('stripe', 'evt_test');
      expect(stripeResult.correlationId).toBe('wh_stripe_evt_test');

      const clerkResult = await service.checkAndMark('clerk', 'msg_abc');
      expect(clerkResult.correlationId).toBe('wh_clerk_msg_abc');

      const waResult = await service.checkAndMark('whatsapp', 'wamid_123');
      expect(waResult.correlationId).toBe('wh_whatsapp_wamid_123');
    });

    it('should store processedAt timestamp in cache value', async () => {
      cacheService.exists.mockResolvedValue(false);
      cacheService.set.mockResolvedValue(true);

      await service.checkAndMark('stripe', 'evt_ts');

      const setCall = cacheService.set.mock.calls[0];
      const storedValue = setCall[1] as { processedAt: string; source: string };
      expect(storedValue.processedAt).toBeDefined();
      expect(new Date(storedValue.processedAt).getTime()).not.toBeNaN();
      expect(storedValue.source).toBe('stripe');
    });
  });
});
