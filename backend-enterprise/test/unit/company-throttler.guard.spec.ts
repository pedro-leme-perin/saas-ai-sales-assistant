import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyThrottlerGuard } from '../../src/common/guards/company-throttler.guard';

jest.setTimeout(15000);

describe('CompanyThrottlerGuard', () => {
  let guard: CompanyThrottlerGuard;
  let cacheService: { checkRateLimit: jest.Mock };
  let reflector: Reflector;
  let mockSuperCanActivate: jest.SpyInstance;

  const createMockContext = (
    overrides: {
      user?: { companyId?: string; id?: string; email?: string };
      company?: { plan?: string };
      skipThrottle?: boolean;
      throttleConfig?: Record<string, unknown> | undefined;
    } = {},
  ): ExecutionContext => {
    const request: Record<string, unknown> = {};
    const response = { setHeader: jest.fn() };

    if (overrides.user) {
      request.user = {
        id: 'user-1',
        email: 'test@test.com',
        companyId: overrides.user.companyId,
        ...overrides.user,
        company: overrides.company || undefined,
      };
    }

    const handler = {} as object;
    const classRef = {} as object;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => handler,
      getClass: () => classRef,
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    cacheService = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 50 }),
    };

    reflector = new Reflector();

    // Create guard with mocked dependencies
    const mockOptions = [{ name: 'default', ttl: 60000, limit: 100 }];
    const mockStorage = {
      getRecord: jest.fn(),
      addRecord: jest.fn(),
    };

    guard = new CompanyThrottlerGuard(
      mockOptions as any,
      mockStorage as any,
      reflector,
      cacheService as any,
    );

    // Mock super.canActivate to avoid ThrottlerGuard internals
    mockSuperCanActivate = jest
      .spyOn(Object.getPrototypeOf(CompanyThrottlerGuard.prototype), 'canActivate')
      .mockResolvedValue(true);

    // Default: no skip, no custom throttle
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
  });

  afterEach(() => {
    mockSuperCanActivate.mockRestore();
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────
  // Unauthenticated requests (IP fallback)
  // ─────────────────────────────────────────

  describe('unauthenticated requests', () => {
    it('should fall back to IP-based throttling when no user', async () => {
      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockSuperCanActivate).toHaveBeenCalledWith(context);
      expect(cacheService.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should fall back to IP-based when user has no companyId', async () => {
      const context = createMockContext({
        user: { companyId: undefined, id: 'user-1', email: 'test@test.com' },
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockSuperCanActivate).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // Authenticated requests (company-based)
  // ─────────────────────────────────────────

  describe('authenticated requests', () => {
    it('should use Redis sliding window for company rate limiting', async () => {
      const context = createMockContext({
        user: { companyId: 'comp-1' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        'rate:company:comp-1:default',
        60, // STARTER default limit
        60,
      );
      expect(mockSuperCanActivate).not.toHaveBeenCalled();
    });

    it('should set rate limit response headers', async () => {
      cacheService.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 42 });
      const context = createMockContext({
        user: { companyId: 'comp-1' },
      });
      const response = context.switchToHttp().getResponse();

      await guard.canActivate(context);

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 60);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 42);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 60);
    });

    it('should throw 429 when rate limit exceeded', async () => {
      cacheService.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      const context = createMockContext({
        user: { companyId: 'comp-1' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  // ─────────────────────────────────────────
  // Plan-based limits
  // ─────────────────────────────────────────

  describe('plan-based limits', () => {
    it('should apply STARTER limits (60/min) by default', async () => {
      const context = createMockContext({
        user: { companyId: 'comp-1' },
      });

      await guard.canActivate(context);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(expect.any(String), 60, 60);
    });

    it('should apply PROFESSIONAL limits (200/min)', async () => {
      const context = createMockContext({
        user: { companyId: 'comp-1' },
        company: { plan: 'PROFESSIONAL' },
      });

      await guard.canActivate(context);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(expect.any(String), 200, 60);
    });

    it('should apply ENTERPRISE limits (500/min)', async () => {
      const context = createMockContext({
        user: { companyId: 'comp-1' },
        company: { plan: 'ENTERPRISE' },
      });

      await guard.canActivate(context);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(expect.any(String), 500, 60);
    });

    it('should fall back to STARTER for unknown plan', async () => {
      const context = createMockContext({
        user: { companyId: 'comp-1' },
        company: { plan: 'UNKNOWN_PLAN' },
      });

      await guard.canActivate(context);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(expect.any(String), 60, 60);
    });
  });

  // ─────────────────────────────────────────
  // Tier resolution
  // ─────────────────────────────────────────

  describe('tier resolution', () => {
    it('should skip rate limiting when @SkipThrottle() is present', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'THROTTLER:SKIP') return true;
        return undefined;
      });

      const context = createMockContext({
        user: { companyId: 'comp-1' },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(cacheService.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should use strict tier for AI endpoints', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'THROTTLER:SKIP') return false;
        if (key === 'THROTTLER:LIMIT') return { strict: { ttl: 60000, limit: 20 } };
        return undefined;
      });

      const context = createMockContext({
        user: { companyId: 'comp-1' },
      });

      await guard.canActivate(context);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        'rate:company:comp-1:strict',
        10, // STARTER strict limit
        60,
      );
    });

    it('should use auth tier for auth endpoints', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'THROTTLER:SKIP') return false;
        if (key === 'THROTTLER:LIMIT') return { auth: { ttl: 60000, limit: 10 } };
        return undefined;
      });

      const context = createMockContext({
        user: { companyId: 'comp-1' },
      });

      await guard.canActivate(context);

      expect(cacheService.checkRateLimit).toHaveBeenCalledWith(
        'rate:company:comp-1:auth',
        20, // STARTER auth limit
        60,
      );
    });
  });

  // ─────────────────────────────────────────
  // Error message format
  // ─────────────────────────────────────────

  describe('error response', () => {
    it('should include plan and limit in error message', async () => {
      cacheService.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
      const context = createMockContext({
        user: { companyId: 'comp-1' },
        company: { plan: 'PROFESSIONAL' },
      });

      try {
        await guard.canActivate(context);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.message).toContain('PROFESSIONAL');
        expect(response.message).toContain('200');
        expect(response.retryAfter).toBe(60);
      }
    });
  });
});
