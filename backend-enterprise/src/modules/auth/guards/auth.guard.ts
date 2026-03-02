import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkStrategy } from '../strategies/clerk.strategy';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  // Paths públicos — fallback para quando o decorator não resolve no build
  private readonly PUBLIC_PATHS = [
    '/api/whatsapp/webhook',
    '/api/whatsapp/webhook/status',
    '/api/billing/webhook',
    '/api/webhooks/clerk',
    '/health',
  ];

  constructor(
    private readonly clerkStrategy: ClerkStrategy,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Whitelist por path (fallback robusto)
    const path = request.path || request.url || '';
    if (this.PUBLIC_PATHS.some((p) => path.startsWith(p))) {
      return true;
    }

    // 2. Decorator @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 3. Autenticação Clerk
    try {
      const user = await this.clerkStrategy.validate(request);
      request.user = user;
      return true;
    } catch (error: any) {
      this.logger.error('Authentication error:', error.message);
      throw new UnauthorizedException('No authentication token provided');
    }
  }
}