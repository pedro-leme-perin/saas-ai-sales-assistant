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

  constructor(
    private readonly clerkStrategy: ClerkStrategy,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url || '';

    // Whitelist: qualquer path contendo whatsapp/webhook
    if (path.includes('whatsapp/webhook') || path.includes('billing/webhook') || path.includes('webhooks/clerk') || path === '/health') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

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
