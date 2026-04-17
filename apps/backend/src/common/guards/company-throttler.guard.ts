// src/common/guards/company-throttler.guard.ts
import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { getOptionsToken } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { AuthUser } from '../../modules/auth/interfaces/auth-user.interface';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { Plan } from '@prisma/client';

/**
 * Extended user type as returned by ClerkStrategy (UserWithCompany)
 * The AuthGuard populates request.user with the full user + company relation
 */
interface AuthUserWithCompany extends AuthUser {
  company?: { plan: Plan };
}

/**
 * Company-aware Rate Limiter using Redis Sliding Window
 *
 * System Design Interview (Cap 4): "Sliding window counters using Redis sorted sets"
 * Release It! (Nygard): "Rate limiting protects against capacity abuse"
 *
 * Strategy:
 * - Authenticated requests: keyed by companyId, limits based on plan
 * - Unauthenticated requests: falls back to NestJS ThrottlerGuard (IP-based)
 *
 * Plan-based limits (per minute):
 * - STARTER:      60 req/min (default), 10 AI, 20 auth
 * - PROFESSIONAL: 200 req/min (default), 40 AI, 50 auth
 * - ENTERPRISE:   500 req/min (default), 100 AI, 100 auth
 */

interface PlanLimits {
  default: number;
  strict: number;
  auth: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  STARTER: { default: 60, strict: 10, auth: 20 },
  PROFESSIONAL: { default: 200, strict: 40, auth: 50 },
  ENTERPRISE: { default: 500, strict: 100, auth: 100 },
};

const DEFAULT_WINDOW_SECONDS = 60;

@Injectable()
export class CompanyThrottlerGuard extends ThrottlerGuard {
  private readonly guardLogger = new Logger(CompanyThrottlerGuard.name);

  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly cacheService: CacheService,
  ) {
    super(options, storageService, reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUserWithCompany | undefined;

    // No authenticated user → fallback to IP-based ThrottlerGuard
    if (!user?.companyId) {
      return super.canActivate(context);
    }

    // Determine throttle tier from decorator metadata
    const tier = this.resolveTier(context);

    // Skip check if @SkipThrottle() is applied
    if (tier === 'skip') {
      return true;
    }

    // Check for custom @RateLimit() options (per-endpoint overrides)
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Plan comes from user.company (populated by ClerkStrategy → UserWithCompany)
    const plan: string = user.company?.plan || 'STARTER';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.STARTER;

    // Custom limit from @RateLimit({ limit: N }) takes precedence over plan-based limits
    const maxRequests =
      rateLimitOptions?.limit || limits[tier as keyof PlanLimits] || limits.default;
    const windowSeconds = rateLimitOptions?.window || DEFAULT_WINDOW_SECONDS;

    const key = `rate:company:${user.companyId}:${tier}`;

    let result: { allowed: boolean; remaining?: number; resetAt?: number };
    try {
      result = await this.cacheService.checkRateLimit(key, maxRequests, windowSeconds);
    } catch (error) {
      // Fail-open: allow request if cache is unavailable (Release It! — Bulkhead)
      this.guardLogger.warn(`Rate limit check failed, allowing request: ${error}`);
      return true;
    }

    if (!result.allowed) {
      this.guardLogger.warn(
        `Rate limit exceeded: company=${user.companyId} plan=${plan} tier=${tier} limit=${maxRequests}/${windowSeconds}s`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Plan ${plan}: ${maxRequests} requests per ${windowSeconds} seconds.`,
          error: 'Too Many Requests',
          retryAfter: windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Set rate limit headers (RFC 6585 / draft-ietf-httpapi-ratelimit-headers)
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', maxRequests);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', windowSeconds);

    return true;
  }

  /**
   * Resolve throttle tier from decorator metadata
   *
   * Checks @SkipThrottle() and @Throttle({ strict/auth: ... }) decorators
   */
  private resolveTier(context: ExecutionContext): string {
    // Check @SkipThrottle()
    const skipThrottle = this.reflector.getAllAndOverride<boolean>('THROTTLER:SKIP', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipThrottle) return 'skip';

    // Check @Throttle({ strict: ... }) or @Throttle({ auth: ... })
    const throttleConfig = this.reflector.getAllAndOverride<Record<string, unknown>>(
      'THROTTLER:LIMIT',
      [context.getHandler(), context.getClass()],
    );

    if (throttleConfig) {
      if ('strict' in throttleConfig) return 'strict';
      if ('auth' in throttleConfig) return 'auth';
    }

    return 'default';
  }
}
