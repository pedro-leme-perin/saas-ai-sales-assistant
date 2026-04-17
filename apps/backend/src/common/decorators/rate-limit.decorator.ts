// src/common/decorators/rate-limit.decorator.ts
//
// Custom @RateLimit() decorator for granular per-endpoint rate limiting.
// Works with CompanyThrottlerGuard which reads THROTTLER:LIMIT metadata.
//
// Usage:
//   @RateLimit({ tier: 'strict' })           // Plan-based strict tier (10/40/100)
//   @RateLimit({ tier: 'auth' })             // Plan-based auth tier (20/50/100)
//   @RateLimit({ limit: 5, window: 60 })     // Custom: 5 requests per 60 seconds
//   @RateLimit({ tier: 'strict', limit: 15 }) // Named tier with custom override
//
// Reference: System Design Interview Cap. 4 — sliding window rate limiting

import { SetMetadata, applyDecorators } from '@nestjs/common';

/**
 * Metadata key used by NestJS ThrottlerGuard and CompanyThrottlerGuard
 * to resolve rate limit configuration from decorator metadata.
 */
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';

/**
 * Custom rate limit metadata key for per-endpoint overrides.
 * CompanyThrottlerGuard reads this for custom limit/window values.
 */
export const RATE_LIMIT_KEY = 'RATE_LIMIT_OPTIONS';

export interface RateLimitOptions {
  /** Named tier matching CompanyThrottlerGuard plan limits: 'strict' | 'auth' | 'default' */
  tier?: 'strict' | 'auth' | 'default';
  /** Custom request limit (overrides plan-based limit when set) */
  limit?: number;
  /** Custom window in seconds (default: 60) */
  window?: number;
}

/**
 * @RateLimit() — Granular per-endpoint rate limiting decorator.
 *
 * Sets metadata compatible with both NestJS @Throttle() and the custom
 * CompanyThrottlerGuard. The guard reads THROTTLER:LIMIT to determine
 * the tier, and RATE_LIMIT_OPTIONS for custom limit/window overrides.
 *
 * Examples:
 * ```typescript
 * @RateLimit({ tier: 'strict' })              // Uses plan-based strict limits
 * @RateLimit({ tier: 'auth' })                // Uses plan-based auth limits
 * @RateLimit({ limit: 5, window: 60 })        // 5 req per 60s, all plans
 * @RateLimit({ tier: 'strict', limit: 15 })   // Strict tier, override to 15
 * ```
 */
export function RateLimit(options: RateLimitOptions = {}): MethodDecorator & ClassDecorator {
  const tier = options.tier || 'default';

  // Build THROTTLER:LIMIT metadata in the format CompanyThrottlerGuard expects.
  // The guard checks for keys 'strict' or 'auth' in this object to resolve tier.
  const throttlerMeta: Record<string, { ttl: number; limit: number }> = {
    [tier]: {
      ttl: (options.window || 60) * 1000, // Convert seconds to ms (NestJS Throttler convention)
      limit: options.limit || 0, // 0 means "use plan-based default for this tier"
    },
  };

  return applyDecorators(
    SetMetadata(THROTTLER_LIMIT_KEY, throttlerMeta),
    SetMetadata(RATE_LIMIT_KEY, {
      tier,
      limit: options.limit,
      window: options.window || 60,
    }),
  );
}
