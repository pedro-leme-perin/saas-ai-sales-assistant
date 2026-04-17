// =============================================
// 🎨 CUSTOM DECORATORS
// =============================================

import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// =============================================
// @CurrentUser() - Get current user from request
// =============================================
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

// =============================================
// @Public() - Mark route as public (no auth)
// =============================================
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// =============================================
// @Roles() - Role-based access control
// =============================================
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// =============================================
// @CompanyId() - Get company ID from request
// =============================================
export const CompanyId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.companyId;
});

// =============================================
// @UserId() - Get user ID from request
// =============================================
export const UserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.id;
});

// =============================================
// @ApiPaginatedResponse() - Swagger pagination
// =============================================
export const PAGINATION_KEY = 'pagination';
export const Paginated = () => SetMetadata(PAGINATION_KEY, true);

// =============================================
// @RateLimit() - Granular per-endpoint rate limiting
// =============================================
export { RateLimit, RATE_LIMIT_KEY } from './rate-limit.decorator';
export type { RateLimitOptions } from './rate-limit.decorator';

// =============================================
// TYPE DEFINITIONS
// =============================================
export interface AuthenticatedUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  permissions: string[];
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
