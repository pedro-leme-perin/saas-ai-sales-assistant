// src/modules/auth/guards/auth.guard.ts

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';
import { UserWithCompany } from '@/modules/users/users.service';

@Injectable()
export class AuthGuard extends PassportAuthGuard('clerk') {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verificar se a rota é pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug('Public route, skipping authentication');
      return true;
    }

    // Executar autenticação Passport
    const result = await super.canActivate(context);
    
    if (!result) {
      return false;
    }

    // Injetar dados do usuário no request
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserWithCompany;

    if (user) {
      // Adicionar companyId para tenant isolation
      request.companyId = user.companyId;
      request.userId = user.id;
    }

    return true;
  }

  handleRequest<TUser = UserWithCompany>(
    err: any,
    user: TUser,
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err) {
      this.logger.error(`Authentication error: ${err.message}`);
      throw err;
    }

    if (!user) {
      this.logger.warn('No user returned from strategy');
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
}
