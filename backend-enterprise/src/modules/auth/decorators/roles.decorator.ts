// =====================================================
// 🛡️ ROLES DECORATOR
// =====================================================
// Custom decorator for Role-Based Access Control (RBAC)
// Based on: Clean Architecture - Authorization patterns
//
// Usage:
// @Roles(UserRole.ADMIN, UserRole.MANAGER)
// @Get('admin-panel')
// async getAdminPanel() {
//   return 'Admin only!';
// }
// =====================================================

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Metadata key for roles
 * Used by RolesGuard to check if user has required role
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict endpoint access to specific roles
 * 
 * Must be used together with RolesGuard:
 * @UseGuards(AuthGuard, RolesGuard)
 * 
 * @example Single role
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @Delete('users/:id')
 * deleteUser(@Param('id') id: string) {
 *   // Only ADMIN can access
 * }
 * ```
 * 
 * @example Multiple roles (OR logic)
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @Get('reports')
 * getReports() {
 *   // ADMIN OR MANAGER can access
 * }
 * ```
 * 
 * @param roles - One or more roles that are allowed to access the endpoint
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to mark endpoint as public (no authentication required)
 * 
 * Use this to bypass AuthGuard for specific endpoints
 * 
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
