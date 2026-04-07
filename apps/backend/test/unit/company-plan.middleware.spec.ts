import { Test, TestingModule } from '@nestjs/testing';
import { CompanyPlanMiddleware } from '../../src/common/middleware/company-plan.middleware';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { Request, Response, NextFunction } from 'express';

jest.setTimeout(15000);

describe('CompanyPlanMiddleware', () => {
  let middleware: CompanyPlanMiddleware;
  let prisma: PrismaService;
  let cache: CacheService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<void>;

  // Mock data
  const mockCompanyId = 'company-123';
  const mockUserId = 'user-456';

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyPlanMiddleware,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    middleware = module.get<CompanyPlanMiddleware>(CompanyPlanMiddleware);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);

    // Initialize mock request/response/next
    mockRequest = {
      user: {
        id: mockUserId,
        companyId: mockCompanyId,
      },
    };
    mockResponse = {};
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  // =====================================================
  // NO USER TESTS
  // =====================================================

  describe('when no user is on request', () => {
    it('should call next() when user is not present', async () => {
      mockRequest.user = undefined;

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockPrismaService.company.findUnique).not.toHaveBeenCalled();
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });

    it('should call next() when user has no companyId', async () => {
      mockRequest.user = { id: mockUserId };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockPrismaService.company.findUnique).not.toHaveBeenCalled();
    });
  });

  // =====================================================
  // CACHE HIT TESTS
  // =====================================================

  describe('when plan is already loaded in request', () => {
    it('should call next() without loading plan when already in request', async () => {
      (mockRequest.user as unknown as Record<string, unknown>).company = { plan: 'PROFESSIONAL' };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(mockPrismaService.company.findUnique).not.toHaveBeenCalled();
    });

    it('should call next() when plan already exists on company object', async () => {
      (mockRequest.user as unknown as Record<string, unknown>).company = { plan: 'ENTERPRISE' };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // =====================================================
  // CACHE LOOKUP TESTS
  // =====================================================

  describe('when loading plan from cache', () => {
    it('should load plan from cache when available', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('STARTER');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheService.get).toHaveBeenCalledWith(`company:plan:${mockCompanyId}`);
      expect(((mockRequest.user as unknown as Record<string, unknown>).company as Record<string, unknown>).plan).toBe('STARTER');
      expect(mockPrismaService.company.findUnique).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should populate company object from cache', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('PROFESSIONAL');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(((mockRequest.user as unknown as Record<string, unknown>) as Record<string, unknown>).company).toBeDefined();
      expect(((mockRequest.user as unknown as Record<string, unknown>).company as Record<string, unknown>).plan).toBe('PROFESSIONAL');
    });

    it('should skip database query on cache hit', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('ENTERPRISE');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrismaService.company.findUnique).not.toHaveBeenCalled();
    });
  });

  // =====================================================
  // DATABASE LOOKUP TESTS
  // =====================================================

  describe('when loading plan from database', () => {
    it('should load plan from database on cache miss', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'PROFESSIONAL',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: mockCompanyId },
        select: { plan: true },
      });
      expect(((mockRequest.user as unknown as Record<string, unknown>).company as Record<string, unknown>).plan).toBe('PROFESSIONAL');
    });

    it('should query database only when cache returns null', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'STARTER',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockPrismaService.company.findUnique).toHaveBeenCalled();
    });

    it('should use correct select clause for performance', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'ENTERPRISE',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: mockCompanyId },
        select: { plan: true },
      });
    });

    it('should populate plan from database result', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'PROFESSIONAL',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(((mockRequest.user as unknown as Record<string, unknown>) as Record<string, unknown>).company).toBeDefined();
      expect(((mockRequest.user as unknown as Record<string, unknown>).company as Record<string, unknown>).plan).toBe('PROFESSIONAL');
    });
  });

  // =====================================================
  // CACHE WRITE TESTS
  // =====================================================

  describe('when caching plan after database lookup', () => {
    it('should cache the plan after fetching from database', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'PROFESSIONAL',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `company:plan:${mockCompanyId}`,
        'PROFESSIONAL',
        300,
      );
    });

    it('should use correct cache TTL', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'STARTER',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        'STARTER',
        300, // 5 minutes
      );
    });

    it('should not cache when company not found in database', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should not cache on error', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  // =====================================================
  // ERROR HANDLING TESTS
  // =====================================================

  describe('when error occurs during plan loading', () => {
    it('should default to STARTER plan on database error', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Middleware should continue even on error (non-blocking)
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle cache error gracefully', async () => {
      (mockCacheService.get as jest.Mock).mockRejectedValue(new Error('Cache error'));

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Should continue to database on cache error
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log warning on database error', async () => {
      const warnSpy = jest.spyOn(middleware['logger'], 'warn');

      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to load company plan for ${mockCompanyId}`),
      );
    });

    it('should continue to next middleware even on error', async () => {
      (mockCacheService.get as jest.Mock).mockRejectedValue(new Error('Cache error'));

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // =====================================================
  // MISSING COMPANY TESTS
  // =====================================================

  describe('when company is not found', () => {
    it('should handle missing company gracefully', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Should continue even if company not found
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set company plan if company not found', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Company object should not be created
      expect(((mockRequest.user as unknown as Record<string, unknown>) as Record<string, unknown>).company).toBeUndefined();
    });

    it('should call next() when company not found', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue(null);

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // =====================================================
  // NEXT INVOCATION TESTS
  // =====================================================

  describe('next() invocation behavior', () => {
    it('should always call next() regardless of outcome', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('PROFESSIONAL');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should call next() even on successful plan load', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'STARTER',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should call next() only once even on error', async () => {
      (mockCacheService.get as jest.Mock).mockRejectedValue(new Error('Error'));

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  // =====================================================
  // DIFFERENT PLANS TESTS
  // =====================================================

  describe('with different plan types', () => {
    it('should handle STARTER plan', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('STARTER');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(((mockRequest.user as unknown as Record<string, unknown>).company as Record<string, unknown>).plan).toBe('STARTER');
    });

    it('should handle PROFESSIONAL plan', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('PROFESSIONAL');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(((mockRequest.user as unknown as Record<string, unknown>).company as Record<string, unknown>).plan).toBe('PROFESSIONAL');
    });

    it('should handle ENTERPRISE plan', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('ENTERPRISE');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(((mockRequest.user as unknown as Record<string, unknown>).company as Record<string, unknown>).plan).toBe('ENTERPRISE');
    });

    it('should cache different plans independently', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);

      // Test STARTER
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'STARTER',
      });
      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Test PROFESSIONAL
      const mockRequest2: Partial<Request> = {
        user: {
          id: 'user-789',
          companyId: 'company-789',
        },
      };
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'PROFESSIONAL',
      });
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);

      await middleware.use(mockRequest2 as Request, mockResponse as Response, mockNext);

      // Should cache both plans with different keys
      expect(mockCacheService.set).toHaveBeenCalledWith(`company:plan:company-123`, 'STARTER', 300);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `company:plan:company-789`,
        'PROFESSIONAL',
        300,
      );
    });
  });

  // =====================================================
  // MULTIPLE REQUESTS TESTS
  // =====================================================

  describe('handling multiple sequential requests', () => {
    it('should load plan for first request from database', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.company.findUnique as jest.Mock).mockResolvedValue({
        plan: 'PROFESSIONAL',
      });

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrismaService.company.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should load plan for second request from cache', async () => {
      (mockCacheService.get as jest.Mock).mockResolvedValue('PROFESSIONAL');

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockPrismaService.company.findUnique).not.toHaveBeenCalled();
    });
  });
});
