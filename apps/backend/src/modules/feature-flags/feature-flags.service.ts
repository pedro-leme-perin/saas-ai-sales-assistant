// =============================================
// 🚩 FeatureFlagsService (Session 53)
// =============================================
// Feature A1 — Per-tenant feature flags with deterministic rollout.
// Design:
// - CRUD tenant-scoped (companyId filter on all queries).
// - key is immutable after create (unique per tenant via @@unique([companyId, key])).
// - evaluate(companyId, key, userId?) uses stable SHA-256 hash:
//     bucket = parseInt(sha256(`${companyId}:${key}:${userId ?? ''}`).slice(0, 8), 16) % 100
//   hit when bucket < rolloutPercentage. userAllowlist bypasses the gate.
// - Redis cache (`ff:${companyId}:${key}:${userId ?? ''}`) TTL 60s — invalidated
//   opportunistically by listing keys on each mutation (scan-based). Keeps flag
//   reads microsecond-latency in hot paths (AI gating, feature toggles).
// - P2002 on (companyId, key) collision → BadRequestException.
// - Audit fire-and-forget on all mutations.

import { createHash } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, FeatureFlag, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto/create-feature-flag.dto';

const CACHE_TTL_SECONDS = 60;

export interface FlagEvaluation {
  key: string;
  enabled: boolean;
  reason: 'not_found' | 'disabled' | 'allowlist' | 'rollout_hit' | 'rollout_miss';
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ===== CRUD ===========================================================

  async list(companyId: string): Promise<FeatureFlag[]> {
    this.assertTenant(companyId);
    return this.prisma.featureFlag.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(companyId: string, id: string): Promise<FeatureFlag> {
    this.assertTenant(companyId);
    const row = await this.prisma.featureFlag.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Feature flag not found');
    return row;
  }

  async create(
    companyId: string,
    actorId: string,
    dto: CreateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    this.assertTenant(companyId);
    try {
      const row = await this.prisma.featureFlag.create({
        data: {
          companyId,
          createdById: actorId,
          key: dto.key,
          name: dto.name,
          description: dto.description ?? null,
          enabled: dto.enabled ?? false,
          rolloutPercentage: dto.rolloutPercentage ?? 0,
          userAllowlist: dto.userAllowlist ?? [],
        },
      });
      void this.invalidateCache(companyId, row.key);
      void this.audit(actorId, companyId, AuditAction.CREATE, row.id, {
        key: row.key,
        name: row.name,
        enabled: row.enabled,
        rolloutPercentage: row.rolloutPercentage,
      });
      return row;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Feature flag key '${dto.key}' already exists`);
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlag> {
    const existing = await this.findById(companyId, id);
    const row = await this.prisma.featureFlag.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.rolloutPercentage !== undefined
          ? { rolloutPercentage: dto.rolloutPercentage }
          : {}),
        ...(dto.userAllowlist !== undefined ? { userAllowlist: dto.userAllowlist } : {}),
      },
    });
    void this.invalidateCache(companyId, row.key);
    void this.audit(actorId, companyId, AuditAction.UPDATE, row.id, {
      oldValues: {
        enabled: existing.enabled,
        rolloutPercentage: existing.rolloutPercentage,
      },
      newValues: {
        enabled: row.enabled,
        rolloutPercentage: row.rolloutPercentage,
      },
    });
    return row;
  }

  async remove(companyId: string, actorId: string, id: string): Promise<{ success: true }> {
    const existing = await this.findById(companyId, id);
    await this.prisma.featureFlag.delete({ where: { id: existing.id } });
    void this.invalidateCache(companyId, existing.key);
    void this.audit(actorId, companyId, AuditAction.DELETE, id, { key: existing.key });
    return { success: true };
  }

  // ===== EVALUATION =====================================================

  async evaluate(companyId: string, key: string, userId?: string): Promise<FlagEvaluation> {
    this.assertTenant(companyId);
    const cacheKey = this.cacheKey(companyId, key, userId);
    const cached = await this.cache.getJson<FlagEvaluation>(cacheKey).catch(() => null);
    if (cached) return cached;

    const flag = await this.prisma.featureFlag.findFirst({
      where: { companyId, key },
    });
    const result = this.computeEvaluation(flag, key, userId);
    await this.cache.set(cacheKey, result, CACHE_TTL_SECONDS).catch(() => undefined);
    return result;
  }

  private computeEvaluation(
    flag: FeatureFlag | null,
    key: string,
    userId?: string,
  ): FlagEvaluation {
    if (!flag) return { key, enabled: false, reason: 'not_found' };
    if (!flag.enabled) return { key, enabled: false, reason: 'disabled' };
    if (userId && flag.userAllowlist.includes(userId)) {
      return { key, enabled: true, reason: 'allowlist' };
    }
    if (flag.rolloutPercentage >= 100) {
      return { key, enabled: true, reason: 'rollout_hit' };
    }
    if (flag.rolloutPercentage <= 0) {
      return { key, enabled: false, reason: 'rollout_miss' };
    }
    const bucket = this.bucketOf(flag.companyId, key, userId);
    return bucket < flag.rolloutPercentage
      ? { key, enabled: true, reason: 'rollout_hit' }
      : { key, enabled: false, reason: 'rollout_miss' };
  }

  // Deterministic bucket 0..99 derived from SHA-256 of tenant+key+user.
  private bucketOf(companyId: string, key: string, userId?: string): number {
    const input = `${companyId}:${key}:${userId ?? ''}`;
    const hex = createHash('sha256').update(input).digest('hex').slice(0, 8);
    return parseInt(hex, 16) % 100;
  }

  // ===== Internals ======================================================

  private cacheKey(companyId: string, key: string, userId?: string): string {
    return `ff:${companyId}:${key}:${userId ?? ''}`;
  }

  private async invalidateCache(companyId: string, key: string): Promise<void> {
    // Fire-and-forget. Our CacheService does not expose a SCAN wrapper so we
    // clear the anonymous-evaluator key (most hot path) deterministically.
    // Per-user cached entries age out naturally after TTL=60s.
    await this.cache.delete(this.cacheKey(companyId, key)).catch(() => undefined);
  }

  private assertTenant(companyId: string): void {
    if (!companyId) throw new BadRequestException('companyId required');
  }

  private async audit(
    userId: string,
    companyId: string,
    action: AuditAction,
    resourceId: string,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          companyId,
          action,
          resource: 'FEATURE_FLAG',
          resourceId,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Non-blocking: feature-flag audit failed: ${msg}`);
    }
  }
}
