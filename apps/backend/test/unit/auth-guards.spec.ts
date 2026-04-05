import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { TenantGuard } from '../../src/modules/auth/guards/tenant.guard';
import { ClerkStrategy } from '../../src/modules/auth/strategies/clerk.strategy';
import { AuthUser } from '../../src/modules/auth/interfaces/auth-user.interface';
import { ROLES_KEY, IS_PUBLIC_KEY } from '../../src/modules/auth/decorators/roles.decorator';

jest.setTimeout(10000);

// =====================================================================
// MOCK CONTEXT & REQUEST BUILDERS
// =====================================================================

interface MockRequest {
  path?: string;
  url?: string;
  user?: AuthUser;
  companyId?: string;
  headers?: Record<string, unknown>;
}

interface MockExecutionContext {
  switchToHttp(): {
    getRequest(): MockRequest;
  };
  getHandler(): unknown;
  getClass(): unknown;
}

function createMockExecutionContext(
  request: MockRequest,
  handlerMetadata?: Record<string, unknown>,
  classMetadata?: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createMockRequest(overrides: MockRequest = {}): MockRequest {
  return {
    path: '/api/calls',
    headers: {},
    ...overrides,
  };
}

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-123',
    clerkId: 'clerk-123',
    email: 'test@example.com',
    name: 'Test User',
    companyId: 'company-123',
    role: UserRole.VENDOR,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-20'),
    ...overrides,
  };
}

// =====================================================================
// 🔐 AUTH GUARD TESTS
// =====================================================================

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;
  let clerkStrategy: ClerkStrategy;

  const mockClerkStrategy = {
    validate: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: ClerkStrategy,
          useValue: mockClerkStrategy,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get<Reflector>(Reflector);
    clerkStrategy = module.get<ClerkStrategy>(ClerkStrategy);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access to /health endpoint without authentication', async () => {
      const context = createMockExecutionContext(createMockRequest({ path: '/health' }));
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockClerkStrategy.validate).not.toHaveBeenCalled();
    });

    it('should allow access to whatsapp/webhook endpoint without authentication', async () => {
      const context = createMockExecutionContext(
        createMockRequest({ path: '/webhook/whatsapp/webhook' }),
      );
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockClerkStrategy.validate).not.toHaveBeenCalled();
    });

    it('should allow access to billing/webhook endpoint without authentication', async () => {
      const context = createMockExecutionContext(
        createMockRequest({ path: '/webhook/billing/webhook' }),
      );
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockClerkStrategy.validate).not.toHaveBeenCalled();
    });

    it('should allow access to webhooks/clerk endpoint without authentication', async () => {
      const context = createMockExecutionContext(createMockRequest({ path: '/webhooks/clerk' }));
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockClerkStrategy.validate).not.toHaveBeenCalled();
    });

    it('should allow access when @Public() decorator is applied', async () => {
      const context = createMockExecutionContext(
        createMockRequest({ path: '/api/public-endpoint' }),
      );
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockClerkStrategy.validate).not.toHaveBeenCalled();
    });

    it('should authenticate user and attach to request on valid token', async () => {
      const user = createAuthUser();
      const request = createMockRequest({ path: '/api/calls' });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      (mockClerkStrategy.validate as jest.Mock).mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user).toEqual(user);
      expect(mockClerkStrategy.validate).toHaveBeenCalledWith(request);
    });

    it('should throw UnauthorizedException when token validation fails', async () => {
      const request = createMockRequest({ path: '/api/calls' });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      (mockClerkStrategy.validate as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('No authentication token provided');
    });

    it('should throw UnauthorizedException when strategy throws non-Error object', async () => {
      const request = createMockRequest({ path: '/api/calls' });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      (mockClerkStrategy.validate as jest.Mock).mockRejectedValue('Unknown error');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should use url fallback when path is not set', async () => {
      const request = createMockRequest({ path: undefined, url: '/health' });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle empty path and url gracefully', async () => {
      const user = createAuthUser();
      const request = createMockRequest({ path: undefined, url: undefined });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
      (mockClerkStrategy.validate as jest.Mock).mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});

// =====================================================================
// 🛡️ ROLES GUARD TESTS
// =====================================================================

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when no roles are required', () => {
      const user = createAuthUser();
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has required role (single role)', () => {
      const user = createAuthUser({ role: UserRole.ADMIN });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
      ]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has one of multiple required roles', () => {
      const user = createAuthUser({ role: UserRole.MANAGER });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
        UserRole.MANAGER,
      ]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required role', () => {
      const user = createAuthUser({ role: UserRole.VENDOR });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
      ]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Insufficient permissions. Required role: ADMIN',
      );
    });

    it('should throw ForbiddenException when user lacks any of multiple required roles', () => {
      const user = createAuthUser({ role: UserRole.VENDOR });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
        UserRole.MANAGER,
      ]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(/ADMIN or MANAGER/);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      const request = createMockRequest({ user: undefined });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
      ]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'User not authenticated',
      );
    });

    it('should allow access with empty roles array', () => {
      const user = createAuthUser();
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow ADMIN to access ADMIN endpoint', () => {
      const user = createAuthUser({
        role: UserRole.ADMIN,
        email: 'admin@example.com',
      });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
      ]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny VENDOR access to ADMIN endpoint', () => {
      const user = createAuthUser({
        role: UserRole.VENDOR,
        email: 'vendor@example.com',
      });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
      ]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow MANAGER access to MANAGER endpoint', () => {
      const user = createAuthUser({ role: UserRole.MANAGER });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.MANAGER,
      ]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow MANAGER access to endpoint allowing ADMIN or MANAGER', () => {
      const user = createAuthUser({ role: UserRole.MANAGER });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
        UserRole.MANAGER,
      ]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny VENDOR access to endpoint requiring ADMIN or MANAGER', () => {
      const user = createAuthUser({ role: UserRole.VENDOR });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
        UserRole.ADMIN,
        UserRole.MANAGER,
      ]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});

// =====================================================================
// 🏢 TENANT GUARD TESTS
// =====================================================================

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantGuard],
    }).compile();

    guard = module.get<TenantGuard>(TenantGuard);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access and inject companyId when user has valid company', () => {
      const user = createAuthUser({ companyId: 'company-456' });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.companyId).toBe('company-456');
    });

    it('should inject companyId matching user.companyId', () => {
      const user = createAuthUser({ companyId: 'my-company-789' });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      expect(request.companyId).toBe('my-company-789');
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      const request = createMockRequest({ user: undefined });
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'User not authenticated',
      );
    });

    it('should throw ForbiddenException when user has no companyId', () => {
      const user = createAuthUser({ companyId: '' });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'User not associated with a company',
      );
    });

    it('should throw ForbiddenException when user.companyId is null/undefined', () => {
      const user = createAuthUser();
      const request = createMockRequest({
        user: { ...user, companyId: '' }
      });
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'User not associated with a company',
      );
    });

    it('should preserve existing request properties when injecting companyId', () => {
      const user = createAuthUser();
      const request = createMockRequest({
        user,
        path: '/api/custom',
        headers: { 'x-custom': 'header' },
      });
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      expect(request.companyId).toBe(user.companyId);
      expect(request.path).toBe('/api/custom');
      expect(request.headers?.['x-custom']).toBe('header');
    });

    it('should allow multiple calls to inject companyId consistently', () => {
      const user = createAuthUser({ companyId: 'company-111' });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      guard.canActivate(context);
      const firstCompanyId = request.companyId;

      guard.canActivate(context);
      const secondCompanyId = request.companyId;

      expect(firstCompanyId).toBe('company-111');
      expect(secondCompanyId).toBe('company-111');
    });

    it('should work with different users in different requests', () => {
      const user1 = createAuthUser({
        id: 'user-1',
        companyId: 'company-1',
      });
      const user2 = createAuthUser({
        id: 'user-2',
        companyId: 'company-2',
      });

      const request1 = createMockRequest({ user: user1 });
      const context1 = createMockExecutionContext(request1);
      guard.canActivate(context1);

      const request2 = createMockRequest({ user: user2 });
      const context2 = createMockExecutionContext(request2);
      guard.canActivate(context2);

      expect(request1.companyId).toBe('company-1');
      expect(request2.companyId).toBe('company-2');
    });

    it('should enforce tenant isolation - prevent user from accessing different company', () => {
      const user = createAuthUser({ companyId: 'company-alice' });
      const request = createMockRequest({ user });
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      // Verify that injected companyId matches user's company, not some other company
      expect(request.companyId).toBe('company-alice');
      expect(request.companyId).not.toBe('company-bob');
    });

    it('should inject companyId even when path contains special characters', () => {
      const user = createAuthUser();
      const request = createMockRequest({
        user,
        path: '/api/calls/123/transcripts?filter=recent&sort=desc',
      });
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.companyId).toBe(user.companyId);
    });
  });
});

// =====================================================================
// INTEGRATION-STYLE TESTS: Guards working together
// =====================================================================

describe('Auth Guards Integration', () => {
  let authGuard: AuthGuard;
  let rolesGuard: RolesGuard;
  let tenantGuard: TenantGuard;
  let reflector: Reflector;
  let clerkStrategy: ClerkStrategy;

  const mockClerkStrategy = {
    validate: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        RolesGuard,
        TenantGuard,
        {
          provide: ClerkStrategy,
          useValue: mockClerkStrategy,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    authGuard = module.get<AuthGuard>(AuthGuard);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    tenantGuard = module.get<TenantGuard>(TenantGuard);
    reflector = module.get<Reflector>(Reflector);
    clerkStrategy = module.get<ClerkStrategy>(ClerkStrategy);

    jest.clearAllMocks();
  });

  it('should allow authenticated admin user to access protected endpoint with TenantGuard', async () => {
    const user = createAuthUser({
      role: UserRole.ADMIN,
      companyId: 'company-x',
    });
    const request = createMockRequest();
    const context = createMockExecutionContext(request);

    (mockReflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false) // AuthGuard: not public
      .mockReturnValueOnce([UserRole.ADMIN]); // RolesGuard: requires ADMIN
    (mockClerkStrategy.validate as jest.Mock).mockResolvedValue(user);

    // 1. AuthGuard authenticates
    await authGuard.canActivate(context);

    // 2. RolesGuard checks roles
    rolesGuard.canActivate(context);

    // 3. TenantGuard injects company
    tenantGuard.canActivate(context);

    expect(request.user).toEqual(user);
    expect(request.companyId).toBe('company-x');
  });

  it('should deny non-admin user from admin endpoint', async () => {
    const user = createAuthUser({ role: UserRole.VENDOR });
    const request = createMockRequest({ user });
    const context = createMockExecutionContext(request);

    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should enforce complete guard chain: auth → roles → tenant', async () => {
    const user = createAuthUser({
      role: UserRole.MANAGER,
      companyId: 'company-y',
    });
    const request = createMockRequest();
    const context = createMockExecutionContext(request);

    (mockReflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.MANAGER, UserRole.ADMIN]);
    (mockClerkStrategy.validate as jest.Mock).mockResolvedValue(user);

    // Execute guard chain
    await authGuard.canActivate(context);
    rolesGuard.canActivate(context);
    const tenantResult = tenantGuard.canActivate(context);

    expect(tenantResult).toBe(true);
    expect(request.user?.role).toBe(UserRole.MANAGER);
    expect(request.companyId).toBe('company-y');
  });
});
