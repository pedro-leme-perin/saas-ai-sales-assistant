// =====================================================
// 🛡️ ROLES GUARD
// =====================================================
// Enforces Role-Based Access Control (RBAC)
// Based on: Clean Architecture - Authorization patterns
//
// Usage:
// @Roles(UserRole.ADMIN, UserRole.MANAGER)
// @UseGuards(AuthGuard, RolesGuard)
// @Get('admin-panel')
// async getAdminPanel() {
//   return 'Admin only!';
// }
// =====================================================

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Role-Based Access Control Guard
 * 
 * MUST be used after AuthGuard to ensure user is authenticated.
 * Works together with @Roles() decorator to restrict access.
 * 
 * Authorization logic:
 * - If no @Roles() decorator → allow access (no restriction)
 * - If @Roles(ADMIN) → only ADMIN can access
 * - If @Roles(ADMIN, MANAGER) → ADMIN OR MANAGER can access (OR logic)
 * 
 * @example Single role
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @UseGuards(AuthGuard, RolesGuard)
 * @Delete('users/:id')
 * deleteUser() {
 *   // Only ADMIN can access
 * }
 * ```
 * 
 * @example Multiple roles (OR logic)
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @UseGuards(AuthGuard, RolesGuard)
 * @Get('reports')
 * getReports() {
 *   // ADMIN OR MANAGER can access
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  /**
   * Validate user has required role(s)
   * 
   * @param context - Execution context with route metadata
   * @returns true if user has at least one required role
   * @throws ForbiddenException if user lacks required role
   */
  canActivate(context: ExecutionContext): boolean {
    // ✅ Extract required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // ✅ If no @Roles() decorator, allow access
    // (Route has no role restrictions)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // ✅ Extract authenticated user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    // ✅ Validate user is authenticated
    // (Should be guaranteed by AuthGuard, but we double-check)
    if (!user) {
      this.logger.error('RolesGuard called before AuthGuard');
      throw new ForbiddenException('User not authenticated');
    }

    // ✅ Check if user has any of the required roles (OR logic)
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `Access denied: User ${user.email} (${user.role}) attempted to access endpoint requiring: ${requiredRoles.join(' OR ')}`,
      );

      throw new ForbiddenException(
        `Insufficient permissions. Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    // ✅ Log successful authorization
    this.logger.debug(
      `Access granted: User ${user.email} (${user.role}) has required role`,
    );

    return true;
  }
}

/**
 * Role hierarchy helper
 * 
 * Some systems need role hierarchy where ADMIN > MANAGER > VENDOR.
 * If you need this, uncomment and use this function:
 */
/*
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.ADMIN]: 3,
  [UserRole.MANAGER]: 2,
  [UserRole.VENDOR]: 1,
};

function hasRoleOrHigher(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
*/
