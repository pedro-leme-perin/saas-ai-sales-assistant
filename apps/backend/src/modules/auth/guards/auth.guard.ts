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
    // Use @Public() decorator exclusively — no fragile path-based whitelist
    // All webhook endpoints (Twilio, Clerk, Stripe, WhatsApp) must use @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    try {
      const user = await this.clerkStrategy.validate(request);
      request.user = user;
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Authentication error:', errorMessage);
      throw new UnauthorizedException('No authentication token provided');
    }
  }
}
