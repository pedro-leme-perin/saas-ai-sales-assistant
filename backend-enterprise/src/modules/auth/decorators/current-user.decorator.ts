// src/modules/auth/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserWithCompany } from '@/modules/users/users.service';

/**
 * Extrai o usuário autenticado do request
 * 
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: UserWithCompany) {
 *   return user;
 * }
 * 
 * @example
 * // Extrair apenas uma propriedade
 * @Get('company')
 * getCompany(@CurrentUser('companyId') companyId: string) {
 *   return { companyId };
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserWithCompany | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserWithCompany;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

/**
 * Extrai o companyId do usuário autenticado (tenant isolation)
 * 
 * @example
 * @Get('calls')
 * getCalls(@CompanyId() companyId: string) {
 *   return this.callsService.findByCompany(companyId);
 * }
 */
export const CompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.companyId || request.user?.companyId;
  },
);

/**
 * Extrai o userId do usuário autenticado
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId || request.user?.id;
  },
);
