import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard, ROLE_HIERARCHY, hasHigherOrEqualRole, canManageUser } from '../../src/common/guards/roles.guard';
import { ROLES_KEY, AuthenticatedUser } from '../../src/common/decorators';

jest.setTimeout(15000);

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (overrides: {
    requiredRoles?: UserRole[];
    user?: AuthenticatedUser | null;
  } = {}): ExecutionContext => {
    const request: Record<string, unknown> = {};

    if (overrides.user !== null) {
      request.user = overrides.user || {
        id: 'user-1',
        clerkId: 'clerk-1',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.VENDOR,
        companyId: 'company-1',
        permissions: [],
      };
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);

    // Mock reflector.getAllAndOverride to return undefined by default
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────
  // No @Roles() decorator - should allow access
  // ─────────────────────────────────────────

  describe('when no @Roles decorator is present', () => {
    it('should allow access when no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockContext({ user: { role: UserRole.VENDOR } as AuthenticatedUser });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access even for unauthenticated user', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockContext({ user: null });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when empty roles array', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
      const context = createMockContext({ user: { role: UserRole.VENDOR } as AuthenticatedUser });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // @Roles(VENDOR) - user has VENDOR role
  // ─────────────────────────────────────────

  describe('when @Roles(VENDOR) is required', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.VENDOR]);
    });

    it('should allow access to VENDOR user', () => {
      const context = createMockContext({
        user: {
          role: UserRole.VENDOR,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'vendor@test.com',
          name: 'Vendor User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access to unauthenticated user', () => {
      const context = createMockContext({ user: null });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should deny access to user with different role', () => {
      const context = createMockContext({
        user: {
          role: UserRole.MANAGER,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'manager@test.com',
          name: 'Manager User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny access to ADMIN user (not in required roles)', () => {
      const context = createMockContext({
        user: {
          role: UserRole.ADMIN,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'admin@test.com',
          name: 'Admin User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Required roles: VENDOR');
    });
  });

  // ─────────────────────────────────────────
  // @Roles(ADMIN, MANAGER) - multiple roles
  // ─────────────────────────────────────────

  describe('when @Roles(ADMIN, MANAGER) is required', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.MANAGER]);
    });

    it('should allow ADMIN user', () => {
      const context = createMockContext({
        user: {
          role: UserRole.ADMIN,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'admin@test.com',
          name: 'Admin User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow MANAGER user', () => {
      const context = createMockContext({
        user: {
          role: UserRole.MANAGER,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'manager@test.com',
          name: 'Manager User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny VENDOR user', () => {
      const context = createMockContext({
        user: {
          role: UserRole.VENDOR,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'vendor@test.com',
          name: 'Vendor User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should include all required roles in error message', () => {
      const context = createMockContext({
        user: {
          role: UserRole.VENDOR,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'vendor@test.com',
          name: 'Vendor User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      try {
        guard.canActivate(context);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
        const message = String(response.message || response);
        expect(message).toContain('ADMIN');
        expect(message).toContain('MANAGER');
      }
    });
  });

  // ─────────────────────────────────────────
  // @Roles(OWNER)
  // ─────────────────────────────────────────

  describe('when @Roles(OWNER) is required', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);
    });

    it('should allow OWNER user', () => {
      const context = createMockContext({
        user: {
          role: UserRole.OWNER,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'owner@test.com',
          name: 'Owner User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny non-OWNER users', () => {
      const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.VENDOR];

      roles.forEach(role => {
        const context = createMockContext({
          user: {
            role,
            id: 'user-1',
            clerkId: 'clerk-1',
            email: `user-${role.toLowerCase()}@test.com`,
            name: `${role} User`,
            companyId: 'company-1',
            permissions: [],
          } as AuthenticatedUser,
        });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });
    });
  });

  // ─────────────────────────────────────────
  // Missing user authentication
  // ─────────────────────────────────────────

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.VENDOR]);
    });

    it('should throw ForbiddenException if no user object', () => {
      const context = createMockContext({ user: null });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should throw ForbiddenException if request.user is undefined', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.VENDOR]);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────
  // Reflector.getAllAndOverride behavior
  // ─────────────────────────────────────────

  describe('reflector integration', () => {
    it('should call getAllAndOverride with correct keys and contexts', () => {
      const mockReflector = new Reflector();
      const spyGetAllAndOverride = jest.spyOn(mockReflector, 'getAllAndOverride').mockReturnValue([UserRole.VENDOR]);

      const guard = new RolesGuard(mockReflector);
      const context = createMockContext({
        user: {
          role: UserRole.VENDOR,
          id: 'user-1',
          clerkId: 'clerk-1',
          email: 'test@test.com',
          name: 'Test User',
          companyId: 'company-1',
          permissions: [],
        } as AuthenticatedUser,
      });

      guard.canActivate(context);

      expect(spyGetAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [context.getHandler(), context.getClass()]);
    });

    it('should check handler and class metadata', () => {
      const handler = { metadata: 'handler' };
      const classRef = { metadata: 'class' };
      const mockReflector = new Reflector();
      const spyGetAllAndOverride = jest.spyOn(mockReflector, 'getAllAndOverride').mockReturnValue([UserRole.VENDOR]);

      const guard = new RolesGuard(mockReflector);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              role: UserRole.VENDOR,
              id: 'user-1',
              clerkId: 'clerk-1',
              email: 'test@test.com',
              name: 'Test User',
              companyId: 'company-1',
              permissions: [],
            },
          }),
        }),
        getHandler: () => handler,
        getClass: () => classRef,
      } as unknown as ExecutionContext;

      guard.canActivate(context);

      expect(spyGetAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [handler, classRef]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// ROLE_HIERARCHY Tests
// ─────────────────────────────────────────────────────────────────

describe('ROLE_HIERARCHY', () => {
  describe('hierarchy values', () => {
    it('should define correct hierarchy levels', () => {
      expect(ROLE_HIERARCHY[UserRole.OWNER]).toBe(4);
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBe(3);
      expect(ROLE_HIERARCHY[UserRole.MANAGER]).toBe(2);
      expect(ROLE_HIERARCHY[UserRole.VENDOR]).toBe(1);
    });

    it('should have OWNER as highest level', () => {
      const values = Object.values(ROLE_HIERARCHY);
      const maxValue = Math.max(...values);
      expect(maxValue).toBe(ROLE_HIERARCHY[UserRole.OWNER]);
    });

    it('should have VENDOR as lowest level', () => {
      const values = Object.values(ROLE_HIERARCHY);
      const minValue = Math.min(...values);
      expect(minValue).toBe(ROLE_HIERARCHY[UserRole.VENDOR]);
    });

    it('should define all UserRole values', () => {
      const definedRoles = Object.keys(ROLE_HIERARCHY).sort();
      const userRoles = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.VENDOR].sort();
      expect(definedRoles).toEqual(userRoles);
    });
  });

  describe('hierarchy ordering', () => {
    it('should have strictly increasing values', () => {
      expect(ROLE_HIERARCHY[UserRole.VENDOR]).toBeLessThan(ROLE_HIERARCHY[UserRole.MANAGER]);
      expect(ROLE_HIERARCHY[UserRole.MANAGER]).toBeLessThan(ROLE_HIERARCHY[UserRole.ADMIN]);
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBeLessThan(ROLE_HIERARCHY[UserRole.OWNER]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// hasHigherOrEqualRole() Tests
// ─────────────────────────────────────────────────────────────────

describe('hasHigherOrEqualRole', () => {
  describe('same role comparisons', () => {
    it('should return true for same role (VENDOR)', () => {
      expect(hasHigherOrEqualRole(UserRole.VENDOR, UserRole.VENDOR)).toBe(true);
    });

    it('should return true for same role (ADMIN)', () => {
      expect(hasHigherOrEqualRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
    });

    it('should return true for same role (OWNER)', () => {
      expect(hasHigherOrEqualRole(UserRole.OWNER, UserRole.OWNER)).toBe(true);
    });
  });

  describe('higher role comparisons', () => {
    it('OWNER should have higher role than ADMIN', () => {
      expect(hasHigherOrEqualRole(UserRole.OWNER, UserRole.ADMIN)).toBe(true);
    });

    it('OWNER should have higher role than VENDOR', () => {
      expect(hasHigherOrEqualRole(UserRole.OWNER, UserRole.VENDOR)).toBe(true);
    });

    it('ADMIN should have higher role than VENDOR', () => {
      expect(hasHigherOrEqualRole(UserRole.ADMIN, UserRole.VENDOR)).toBe(true);
    });

    it('ADMIN should have higher role than MANAGER', () => {
      expect(hasHigherOrEqualRole(UserRole.ADMIN, UserRole.MANAGER)).toBe(true);
    });

    it('MANAGER should have higher role than VENDOR', () => {
      expect(hasHigherOrEqualRole(UserRole.MANAGER, UserRole.VENDOR)).toBe(true);
    });
  });

  describe('lower role comparisons', () => {
    it('VENDOR should not have higher role than ADMIN', () => {
      expect(hasHigherOrEqualRole(UserRole.VENDOR, UserRole.ADMIN)).toBe(false);
    });

    it('VENDOR should not have higher role than OWNER', () => {
      expect(hasHigherOrEqualRole(UserRole.VENDOR, UserRole.OWNER)).toBe(false);
    });

    it('ADMIN should not have higher role than OWNER', () => {
      expect(hasHigherOrEqualRole(UserRole.ADMIN, UserRole.OWNER)).toBe(false);
    });

    it('MANAGER should not have higher role than ADMIN', () => {
      expect(hasHigherOrEqualRole(UserRole.MANAGER, UserRole.ADMIN)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// canManageUser() Tests
// ─────────────────────────────────────────────────────────────────

describe('canManageUser', () => {
  describe('OWNER managing other roles', () => {
    it('OWNER can manage ADMIN', () => {
      expect(canManageUser(UserRole.OWNER, UserRole.ADMIN)).toBe(true);
    });

    it('OWNER can manage MANAGER', () => {
      expect(canManageUser(UserRole.OWNER, UserRole.MANAGER)).toBe(true);
    });

    it('OWNER can manage VENDOR', () => {
      expect(canManageUser(UserRole.OWNER, UserRole.VENDOR)).toBe(true);
    });

    it('OWNER cannot manage OWNER (same role)', () => {
      expect(canManageUser(UserRole.OWNER, UserRole.OWNER)).toBe(false);
    });
  });

  describe('ADMIN managing other roles', () => {
    it('ADMIN can manage MANAGER', () => {
      expect(canManageUser(UserRole.ADMIN, UserRole.MANAGER)).toBe(true);
    });

    it('ADMIN can manage VENDOR', () => {
      expect(canManageUser(UserRole.ADMIN, UserRole.VENDOR)).toBe(true);
    });

    it('ADMIN cannot manage ADMIN (same role)', () => {
      expect(canManageUser(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
    });

    it('ADMIN cannot manage OWNER (higher role)', () => {
      expect(canManageUser(UserRole.ADMIN, UserRole.OWNER)).toBe(false);
    });
  });

  describe('MANAGER managing other roles', () => {
    it('MANAGER can manage VENDOR', () => {
      expect(canManageUser(UserRole.MANAGER, UserRole.VENDOR)).toBe(true);
    });

    it('MANAGER cannot manage MANAGER (same role)', () => {
      expect(canManageUser(UserRole.MANAGER, UserRole.MANAGER)).toBe(false);
    });

    it('MANAGER cannot manage ADMIN (higher role)', () => {
      expect(canManageUser(UserRole.MANAGER, UserRole.ADMIN)).toBe(false);
    });

    it('MANAGER cannot manage OWNER (higher role)', () => {
      expect(canManageUser(UserRole.MANAGER, UserRole.OWNER)).toBe(false);
    });
  });

  describe('VENDOR managing other roles', () => {
    it('VENDOR cannot manage any role', () => {
      expect(canManageUser(UserRole.VENDOR, UserRole.VENDOR)).toBe(false);
      expect(canManageUser(UserRole.VENDOR, UserRole.MANAGER)).toBe(false);
      expect(canManageUser(UserRole.VENDOR, UserRole.ADMIN)).toBe(false);
      expect(canManageUser(UserRole.VENDOR, UserRole.OWNER)).toBe(false);
    });
  });

  describe('hierarchy enforcement', () => {
    it('should only allow managing strictly lower roles', () => {
      // A user can only manage users with strictly lower role value
      Object.values(UserRole).forEach(managerRole => {
        Object.values(UserRole).forEach(targetRole => {
          const canManage = canManageUser(managerRole, targetRole);
          const managerHierarchy = ROLE_HIERARCHY[managerRole];
          const targetHierarchy = ROLE_HIERARCHY[targetRole];

          // Can manage if manager's hierarchy is strictly greater
          expect(canManage).toBe(managerHierarchy > targetHierarchy);
        });
      });
    });
  });
});
