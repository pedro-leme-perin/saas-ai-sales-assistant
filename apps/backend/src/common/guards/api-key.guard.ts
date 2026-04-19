// =====================================================
// API KEY GUARD
// =====================================================
// Validates requests authenticated via X-API-Key header
// against hashed keys stored in the ApiKey database model.
//
// Checks: existence, hash match, active status, expiration,
// required scopes. Increments usage counter on success.
//
// Usage: Apply @UseApiKey() or @UseApiKey('scope1', 'scope2')
// to specific controller methods or classes.
//
// This guard is NOT applied globally — it is opt-in via
// the @UseApiKey() decorator for endpoints that need
// API key authentication instead of (or alongside) JWT.
//
// Reference: Building Microservices Cap. 11 — API Security
// Reference: Release It! — Fail Fast
// =====================================================

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  Logger,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';

/** Metadata key for required API key scopes */
export const API_KEY_SCOPES_KEY = 'api-key-scopes';

/**
 * Decorator that applies ApiKeyGuard and optionally sets required scopes.
 *
 * @example
 * // No specific scopes required — any valid API key works
 * @UseApiKey()
 * @Get('data')
 * getData() { ... }
 *
 * @example
 * // Requires 'calls:read' scope on the API key
 * @UseApiKey('calls:read')
 * @Get('calls')
 * getCalls() { ... }
 */
export function UseApiKey(...scopes: string[]) {
  return applyDecorators(SetMetadata(API_KEY_SCOPES_KEY, scopes), UseGuards(ApiKeyGuard));
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    // Hash the provided key to compare against stored hashes
    // API keys are stored as SHA-256 hashes — never in plaintext
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Look up the key in the database
    const storedKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { company: { select: { id: true, plan: true } } },
    });

    if (!storedKey) {
      this.logger.warn(
        `API key authentication failed: unknown key (prefix: ${apiKey.substring(0, 8)}...)`,
      );
      throw new UnauthorizedException('Invalid API key');
    }

    // Check active status
    if (!storedKey.isActive) {
      this.logger.warn(
        `API key authentication failed: inactive key "${storedKey.name}" (company: ${storedKey.companyId})`,
      );
      throw new UnauthorizedException('API key is inactive');
    }

    // Check expiration
    if (storedKey.expiresAt && storedKey.expiresAt < new Date()) {
      this.logger.warn(
        `API key authentication failed: expired key "${storedKey.name}" (company: ${storedKey.companyId})`,
      );
      throw new UnauthorizedException('API key has expired');
    }

    // Check required scopes
    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredScopes.length > 0) {
      const hasAllScopes = requiredScopes.every((scope) => storedKey.scopes.includes(scope));

      if (!hasAllScopes) {
        this.logger.warn(
          `API key "${storedKey.name}" missing scopes: ${requiredScopes.filter((s) => !storedKey.scopes.includes(s)).join(', ')}`,
        );
        throw new UnauthorizedException(
          `API key missing required scopes: ${requiredScopes.join(', ')}`,
        );
      }
    }

    // Timing-safe comparison of the hash to prevent timing attacks
    // (defense-in-depth — findUnique already matched, but validates integrity)
    const storedHashBuffer = Buffer.from(storedKey.keyHash, 'hex');
    const providedHashBuffer = Buffer.from(keyHash, 'hex');

    if (
      storedHashBuffer.length !== providedHashBuffer.length ||
      !timingSafeEqual(storedHashBuffer, providedHashBuffer)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Per-key sliding-window rate limit (Release It! Bulkhead + SDI Cap.4).
    // When `rateLimitPerMin` is null, fall back to plan-level CompanyThrottlerGuard.
    if (storedKey.rateLimitPerMin && storedKey.rateLimitPerMin > 0) {
      const { allowed, remaining } = await this.cache.checkRateLimit(
        `ratelimit:apikey:${storedKey.id}`,
        storedKey.rateLimitPerMin,
        60,
      );
      if (!allowed) {
        this.logger.warn(
          `API key "${storedKey.name}" exceeded per-key limit (${storedKey.rateLimitPerMin}/min)`,
        );
        throw new HttpException('API key rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }
      const res = context
        .switchToHttp()
        .getResponse<{ setHeader?: (k: string, v: string) => void }>();
      res.setHeader?.('X-RateLimit-Limit', String(storedKey.rateLimitPerMin));
      res.setHeader?.('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    }

    // Increment usage counter (non-blocking — fire and forget)
    this.prisma.apiKey
      .update({
        where: { id: storedKey.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to update API key usage: ${err instanceof Error ? err.message : err}`,
        );
      });

    // Attach company info to request for downstream use
    const req = request as unknown as Record<string, unknown>;
    req['apiKeyCompanyId'] = storedKey.companyId;
    req['apiKeyScopes'] = storedKey.scopes;
    req['apiKeyName'] = storedKey.name;

    return true;
  }
}
