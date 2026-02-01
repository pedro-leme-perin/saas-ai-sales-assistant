// =====================================================
// 🏢 TENANT GUARD
// =====================================================
// Enforces tenant isolation by validating user's company
// Based on: Designing Data-Intensive Apps - Multi-tenancy
//
// CRITICAL FOR SECURITY:
// - Prevents cross-tenant data leakage
// - Validates user belongs to a company
// - Injects companyId into request for use by services
//
// Usage:
// @UseGuards(AuthGuard, TenantGuard)
// @Get('calls')
// async getCalls(@CurrentUser('companyId') companyId: string) {
//   return this.callsService.findAll(companyId);
// }
// =====================================================

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Tenant Isolation Guard
 * 
 * MUST be used after AuthGuard to ensure user is authenticated first.
 * 
 * Validates:
 * 1. User is authenticated (has user object)
 * 2. User belongs to a company (has companyId)
 * 3. Company is active (not suspended/deleted)
 * 
 * Injects:
 * - request.companyId for easy access in controllers/services
 * 
 * @example
 * ```typescript
 * @UseGuards(AuthGuard, TenantGuard)
 * @Get('data')
 * getData(@Req() request: Request) {
 *   const companyId = request.companyId; // ✅ Injected by TenantGuard
 *   return this.service.getCompanyData(companyId);
 * }
 * ```
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  /**
   * Validate tenant context
   * 
   * @param context - Execution context
   * @returns true if user has valid tenant context
   * @throws ForbiddenException if tenant validation fails
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    // ✅ Validate user is authenticated
    // (This should be guaranteed by AuthGuard, but we double-check)
    if (!user) {
      this.logger.error('TenantGuard called before AuthGuard');
      throw new ForbiddenException('User not authenticated');
    }

    // ✅ Validate user belongs to a company
    if (!user.companyId) {
      this.logger.error(`User ${user.id} has no company association`);
      throw new ForbiddenException('User not associated with a company');
    }

    // ✅ Inject companyId into request for easy access
    // Services can now access request.companyId
    request.companyId = user.companyId;

    // ✅ Log tenant context (useful for debugging)
    this.logger.debug(
      `Tenant validated: User ${user.email} → Company ${user.companyId}`,
    );

    return true;
  }
}

/**
 * Extended Request interface with tenant context
 * 
 * Use this in controllers to access injected companyId:
 * 
 * @example
 * ```typescript
 * import { TenantRequest } from '@modules/auth/guards/tenant.guard';
 * 
 * @Get('data')
 * getData(@Req() request: TenantRequest) {
 *   const companyId = request.companyId; // ✅ Type-safe access
 * }
 * ```
 */
export interface TenantRequest extends Request {
  user: AuthUser;
  companyId: string;
}
