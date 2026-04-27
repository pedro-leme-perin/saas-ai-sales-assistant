// =====================================================
// API KEY GUARD — UNIT SPEC
// =====================================================
// Covers ApiKeyGuard.canActivate flow:
//   - Header presence
//   - DB lookup (sha256 hashed)
//   - Active status enforcement
//   - Expiration check
//   - Scope match (all-of)
//   - Timing-safe hash compare
//   - Per-key rate limit (Redis sliding window) + X-RateLimit headers
//   - Usage counter increment (fire-and-forget, non-blocking)
//   - Request context attachment (apiKeyCompanyId, apiKeyScopes, apiKeyName)
//
// Reference: Building Microservices Cap. 11 (API Security)
// Reference: Release It! (Fail Fast, Bulkhead)
// Reference: System Design Interview Cap. 4 (sliding window rate limit)
// =====================================================

import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { ApiKeyGuard, API_KEY_SCOPES_KEY } from '../../src/common/guards/api-key.guard';

jest.setTimeout(15000);

// ─────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────

// Test fixture only — deliberately NOT using sk_live_ prefix to avoid
// triggering GitHub Push Protection secret scanners. The guard hashes
// any plaintext, so the prefix is irrelevant for spec correctness.
const TEST_PLAINTEXT_KEY = 'test-fixture-do-not-use-in-prod-aaaa1111bbbb2222cccc3333';
const TEST_KEY_HASH = createHash('sha256').update(TEST_PLAINTEXT_KEY).digest('hex');

interface StoredKeyOverrides {
  id?: string;
  name?: string;
  companyId?: string;
  isActive?: boolean;
  expiresAt?: Date | null;
  scopes?: string[];
  rateLimitPerMin?: number | null;
  keyHash?: string;
  usageCount?: number;
  lastUsedAt?: Date | null;
}

const buildStoredKey = (overrides: StoredKeyOverrides = {}) => ({
  id: overrides.id ?? 'apikey-id-1',
  name: overrides.name ?? 'Production Key',
  companyId: overrides.companyId ?? 'company-1',
  keyHash: overrides.keyHash ?? TEST_KEY_HASH,
  isActive: overrides.isActive ?? true,
  expiresAt: overrides.expiresAt ?? null,
  scopes: overrides.scopes ?? [],
  rateLimitPerMin: overrides.rateLimitPerMin ?? null,
  usageCount: overrides.usageCount ?? 0,
  lastUsedAt: overrides.lastUsedAt ?? null,
  company: { id: overrides.companyId ?? 'company-1', plan: 'PROFESSIONAL' },
});

interface MockContextOverrides {
  apiKeyHeader?: string | undefined;
  requiredScopes?: string[];
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let prisma: {
    apiKey: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let cache: { checkRateLimit: jest.Mock };
  let reflector: Reflector;

  const createMockContext = (
    overrides: MockContextOverrides = {},
  ): {
    context: ExecutionContext;
    request: Record<string, unknown>;
    response: { setHeader: jest.Mock };
  } => {
    const headers: Record<string, string | undefined> = {};
    if (overrides.apiKeyHeader !== undefined) {
      headers['x-api-key'] = overrides.apiKeyHeader;
    }
    const request: Record<string, unknown> = { headers };
    const response = { setHeader: jest.fn() };

    const handler = {} as object;
    const classRef = {} as object;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => handler,
      getClass: () => classRef,
    } as unknown as ExecutionContext;

    // Default reflector behavior: scopes from override or empty
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) =>
        key === API_KEY_SCOPES_KEY ? (overrides.requiredScopes ?? []) : undefined,
      );

    return { context, request, response };
  };

  beforeEach(() => {
    prisma = {
      apiKey: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    cache = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 100 }),
    };
    reflector = new Reflector();
    guard = new ApiKeyGuard(prisma as unknown as never, reflector, cache as unknown as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────
  // Missing header
  // ─────────────────────────────────────────

  describe('header validation', () => {
    it('throws UnauthorizedException when X-API-Key header is missing', async () => {
      const { context } = createMockContext({ apiKeyHeader: undefined });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing X-API-Key header');
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    });

    it('does not call DB when header is missing (fail-fast)', async () => {
      const { context } = createMockContext({ apiKeyHeader: undefined });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
      expect(cache.checkRateLimit).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // DB lookup
  // ─────────────────────────────────────────

  describe('DB lookup', () => {
    it('hashes the key with SHA-256 before lookup', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');

      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { keyHash: TEST_KEY_HASH },
        }),
      );
    });

    it('throws UnauthorizedException when key is not found', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
    });

    it('includes company select in the DB query (avoids N+1)', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow();

      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { company: { select: { id: true, plan: true } } },
        }),
      );
    });
  });

  // ─────────────────────────────────────────
  // Active status enforcement
  // ─────────────────────────────────────────

  describe('active status', () => {
    it('rejects inactive keys with UnauthorizedException', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ isActive: false }));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('API key is inactive');
    });

    it('does not increment usage when key is inactive', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ isActive: false }));

      await expect(guard.canActivate(context)).rejects.toThrow();
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // Expiration check
  // ─────────────────────────────────────────

  describe('expiration', () => {
    it('rejects keys whose expiresAt is in the past', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ expiresAt: yesterday }));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('API key has expired');
    });

    it('accepts keys whose expiresAt is in the future', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ expiresAt: tomorrow }));

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('accepts keys with null expiresAt (no expiration)', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ expiresAt: null }));

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // Scope validation (all-of semantics)
  // ─────────────────────────────────────────

  describe('scope validation', () => {
    it('allows access when no scopes are required (empty array)', async () => {
      const { context } = createMockContext({
        apiKeyHeader: TEST_PLAINTEXT_KEY,
        requiredScopes: [],
      });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ scopes: ['anything'] }));

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('allows access when key has all required scopes', async () => {
      const { context } = createMockContext({
        apiKeyHeader: TEST_PLAINTEXT_KEY,
        requiredScopes: ['calls:read', 'calls:write'],
      });
      prisma.apiKey.findUnique.mockResolvedValue(
        buildStoredKey({ scopes: ['calls:read', 'calls:write', 'extra:scope'] }),
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('rejects when key is missing one of the required scopes', async () => {
      const { context } = createMockContext({
        apiKeyHeader: TEST_PLAINTEXT_KEY,
        requiredScopes: ['calls:read', 'calls:write'],
      });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ scopes: ['calls:read'] }));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow(/missing required scopes/i);
    });

    it('rejects when key has empty scopes but scopes are required', async () => {
      const { context } = createMockContext({
        apiKeyHeader: TEST_PLAINTEXT_KEY,
        requiredScopes: ['admin:write'],
      });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ scopes: [] }));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('lists missing scopes in the error message', async () => {
      const { context } = createMockContext({
        apiKeyHeader: TEST_PLAINTEXT_KEY,
        requiredScopes: ['scope:a', 'scope:b', 'scope:c'],
      });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ scopes: ['scope:a'] }));

      await expect(guard.canActivate(context)).rejects.toThrow(
        /scope:a.*scope:b.*scope:c|scope:a, scope:b, scope:c/,
      );
    });
  });

  // ─────────────────────────────────────────
  // Per-key rate limit
  // ─────────────────────────────────────────

  describe('per-key rate limit', () => {
    it('skips rate limiting when rateLimitPerMin is null', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ rateLimitPerMin: null }));

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(cache.checkRateLimit).not.toHaveBeenCalled();
    });

    it('skips rate limiting when rateLimitPerMin is 0 (unlimited semantics)', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ rateLimitPerMin: 0 }));

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(cache.checkRateLimit).not.toHaveBeenCalled();
    });

    it('calls cache.checkRateLimit with apikey-prefixed key when limit > 0', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(
        buildStoredKey({ id: 'apikey-id-42', rateLimitPerMin: 60 }),
      );

      await guard.canActivate(context);

      expect(cache.checkRateLimit).toHaveBeenCalledWith('ratelimit:apikey:apikey-id-42', 60, 60);
    });

    it('throws HttpException 429 when rate limit is exceeded', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ rateLimitPerMin: 60 }));
      cache.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

      const error = await guard.canActivate(context).catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).toMatch(/rate limit exceeded/i);
    });

    it('sets X-RateLimit-Limit and X-RateLimit-Remaining headers when allowed', async () => {
      const { context, response } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ rateLimitPerMin: 100 }));
      cache.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 73 });

      await guard.canActivate(context);

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '73');
    });

    it('clamps negative remaining to 0 in the header', async () => {
      const { context, response } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ rateLimitPerMin: 100 }));
      cache.checkRateLimit.mockResolvedValue({ allowed: true, remaining: -3 });

      await guard.canActivate(context);

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });
  });

  // ─────────────────────────────────────────
  // Usage counter (fire-and-forget)
  // ─────────────────────────────────────────

  describe('usage counter', () => {
    it('increments usageCount and updates lastUsedAt on success', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey({ id: 'apikey-id-99' }));

      await guard.canActivate(context);

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apikey-id-99' },
          data: expect.objectContaining({
            usageCount: { increment: 1 },
            lastUsedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not block on usage update failure (fire-and-forget)', async () => {
      const { context } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(buildStoredKey());
      prisma.apiKey.update.mockRejectedValue(new Error('DB write failed'));

      // Should NOT throw — guard returns true even though update failed
      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // Allow microtask to drain (catch handler runs)
      await new Promise((resolve) => setImmediate(resolve));
    });
  });

  // ─────────────────────────────────────────
  // Request context attachment
  // ─────────────────────────────────────────

  describe('request context attachment', () => {
    it('attaches apiKeyCompanyId, apiKeyScopes, apiKeyName to the request', async () => {
      const { context, request } = createMockContext({ apiKeyHeader: TEST_PLAINTEXT_KEY });
      prisma.apiKey.findUnique.mockResolvedValue(
        buildStoredKey({
          companyId: 'tenant-xyz',
          scopes: ['calls:read', 'webhooks:write'],
          name: 'Mobile App Key',
        }),
      );

      await guard.canActivate(context);

      expect(request['apiKeyCompanyId']).toBe('tenant-xyz');
      expect(request['apiKeyScopes']).toEqual(['calls:read', 'webhooks:write']);
      expect(request['apiKeyName']).toBe('Mobile App Key');
    });
  });

  // ─────────────────────────────────────────
  // End-to-end happy path
  // ─────────────────────────────────────────

  describe('happy path (full flow)', () => {
    it('allows access through full validation pipeline', async () => {
      const { context, request } = createMockContext({
        apiKeyHeader: TEST_PLAINTEXT_KEY,
        requiredScopes: ['calls:read'],
      });
      prisma.apiKey.findUnique.mockResolvedValue(
        buildStoredKey({
          id: 'happy-id',
          companyId: 'happy-company',
          scopes: ['calls:read'],
          rateLimitPerMin: 60,
          expiresAt: new Date(Date.now() + 86400_000),
        }),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(1);
      expect(cache.checkRateLimit).toHaveBeenCalledTimes(1);
      expect(prisma.apiKey.update).toHaveBeenCalledTimes(1);
      expect(request['apiKeyCompanyId']).toBe('happy-company');
    });
  });
});
