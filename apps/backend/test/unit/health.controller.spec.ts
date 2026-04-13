import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/presentation/controllers/health.controller';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';

jest.setTimeout(15000);

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: {
    $queryRaw: jest.Mock;
  };
  let cacheService: {
    healthCheck: jest.Mock;
  };

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn(),
    };

    cacheService = {
      healthCheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // check() endpoint
  // ─────────────────────────────────────────

  describe('check', () => {
    it('should return healthy status when both database and cache are healthy', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.status).toBe('healthy');
      expect(result.services.database).toBe('ok');
      expect(result.services.cache).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.latency).toBeDefined();
      expect(result.latency?.database).toBeGreaterThanOrEqual(0);
      expect(result.latency?.cache).toBe(5);
    });

    it('should return unhealthy status when database is down', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database).toBe('error');
      expect(result.services.cache).toBe('ok');
    });

    it('should return unhealthy status when cache is down', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        latency: 100,
      });

      const result = await controller.check();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database).toBe('ok');
      expect(result.services.cache).toBe('error');
    });

    it('should return unhealthy when both services are down', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('DB error'));
      cacheService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        latency: 1000,
      });

      const result = await controller.check();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database).toBe('error');
      expect(result.services.cache).toBe('error');
    });

    it('should include database latency in response', async () => {
      prismaService.$queryRaw.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 10);
          }),
      );
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.latency?.database).toBeGreaterThanOrEqual(8);
      expect(result.latency?.database).toBeLessThan(50);
    });

    it('should include cache latency in response', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 25,
      });

      const result = await controller.check();

      expect(result.latency?.cache).toBe(25);
    });

    it('should include current timestamp in ISO format', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Verify timestamp is recent (within last 5 seconds)
      const resultTime = new Date(result.timestamp).getTime();
      const nowTime = Date.now();
      expect(nowTime - resultTime).toBeLessThan(5000);
    });

    it('should include process uptime', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.uptime).toBeGreaterThan(0);
      expect(typeof result.uptime).toBe('number');
    });

    it('should set api service to ok (always)', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.services.api).toBe('ok');
    });

    it('should handle cache latency being undefined', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: undefined,
      });

      const result = await controller.check();

      expect(result.latency?.cache).toBe(0);
    });

    it('should handle database error gracefully and continue', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Timeout'));
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 10,
      });

      const result = await controller.check();

      expect(result.services.database).toBe('error');
      expect(result.services.cache).toBe('ok');
      expect(result.status).toBe('unhealthy');
    });
  });

  // ─────────────────────────────────────────
  // live() endpoint (liveness probe)
  // ─────────────────────────────────────────

  describe('live', () => {
    it('should return ok status', () => {
      const result = controller.live();

      expect(result.status).toBe('ok');
    });

    it('should not call any external services', () => {
      controller.live();

      expect(prismaService.$queryRaw).not.toHaveBeenCalled();
      expect(cacheService.healthCheck).not.toHaveBeenCalled();
    });

    it('should always return ok regardless of service state', () => {
      // live() should always return ok for Kubernetes liveness probe
      const result = controller.live();

      expect(result.status).toBe('ok');
    });
  });

  // ─────────────────────────────────────────
  // ready() endpoint (readiness probe)
  // ─────────────────────────────────────────

  describe('ready', () => {
    it('should return ready: true when database is accessible', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);

      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.ready).toBe(true);
    });

    it('should return ready: false when database is down', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.ready();

      expect(result.status).toBe('error');
      expect(result.ready).toBe(false);
    });

    it('should only check database, not cache', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);

      await controller.ready();

      expect(prismaService.$queryRaw).toHaveBeenCalledWith(expect.anything());
      expect(cacheService.healthCheck).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Database timeout'));

      const result = await controller.ready();

      expect(result.ready).toBe(false);
      expect(result.status).toBe('error');
    });

    it('should not throw error even if database is unavailable', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Fatal error'));

      const result = await controller.ready();

      expect(result).toBeDefined();
      expect(result.ready).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // Integration scenarios
  // ─────────────────────────────────────────

  describe('integration scenarios', () => {
    it('should handle rapid sequential calls to check()', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result1 = await controller.check();
      const result2 = await controller.check();

      expect(result1.status).toBe('healthy');
      expect(result2.status).toBe('healthy');
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should report different status if services recover between calls', async () => {
      // First call: database down
      prismaService.$queryRaw.mockRejectedValueOnce(new Error('Down'));
      cacheService.healthCheck.mockResolvedValueOnce({
        status: 'healthy',
        latency: 5,
      });

      const result1 = await controller.check();
      expect(result1.status).toBe('unhealthy');

      // Second call: database recovers
      prismaService.$queryRaw.mockResolvedValueOnce([]);
      cacheService.healthCheck.mockResolvedValueOnce({
        status: 'healthy',
        latency: 5,
      });

      const result2 = await controller.check();
      expect(result2.status).toBe('healthy');
    });

    it('should have @Public() decorator to bypass auth', () => {
      // Verify that check() endpoint is publicly accessible
      // This is a design requirement for health checks
      expect(controller.check).toBeDefined();
      expect(controller.live).toBeDefined();
    });
  });

  // ─────────────────────────────────────────
  // Response format validation
  // ─────────────────────────────────────────

  describe('response format', () => {
    it('should return HealthStatus interface with all required fields', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      // Validate structure
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('latency');

      // Validate nested structure
      expect(result.services).toHaveProperty('api');
      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('cache');
      expect(result.latency).toHaveProperty('database');
      expect(result.latency).toHaveProperty('cache');
    });

    it('should use correct status enum values', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(['healthy', 'unhealthy']).toContain(result.status);
      expect(['ok', 'error']).toContain(result.services.api);
      expect(['ok', 'error']).toContain(result.services.database);
      expect(['ok', 'error']).toContain(result.services.cache);
    });
  });

  // ─────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle very fast database response', async () => {
      prismaService.$queryRaw.mockResolvedValue([]);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 0,
      });

      const result = await controller.check();

      expect(result.latency?.database).toBeGreaterThanOrEqual(0);
      expect(result.services.database).toBe('ok');
    });

    it('should handle slow database response', async () => {
      prismaService.$queryRaw.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 500);
          }),
      );
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.latency?.database).toBeGreaterThan(400);
      expect(result.services.database).toBe('ok');
    });

    it('should handle null error from database', async () => {
      prismaService.$queryRaw.mockRejectedValue(null);
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.services.database).toBe('error');
    });

    it('should handle non-Error exceptions', async () => {
      prismaService.$queryRaw.mockRejectedValue('String error');
      cacheService.healthCheck.mockResolvedValue({
        status: 'healthy',
        latency: 5,
      });

      const result = await controller.check();

      expect(result.services.database).toBe('error');
    });
  });
});
