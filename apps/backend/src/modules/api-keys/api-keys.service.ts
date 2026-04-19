// =============================================
// 📄 API KEYS SERVICE (Session 47)
// =============================================
// Tenant-scoped CRUD for ApiKey rows. Creation and rotation emit
// a one-time plaintext secret (caller MUST persist it — never
// stored or re-shown afterwards, only the SHA-256 hash is kept).
// Per-key rate limits (`rateLimitPerMin`) are enforced by
// ApiKeyGuard via CacheService.checkRateLimit (sliding window).
// =============================================

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiKey, AuditAction, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

const KEY_TOKEN_BYTES = 32; // 256 bits
const KEY_PREFIX = 'sk_live_';
const DISPLAY_PREFIX_LEN = 12; // sk_live_ + 4 chars after
const RESOURCE = 'API_KEY';

/** ApiKey row with the plaintext key exposed exactly once (on create/rotate). */
export interface IssuedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  rateLimitPerMin: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  /** Full plaintext key (e.g. `sk_live_…`). Shown once; never stored. */
  plaintextKey: string;
}

/** Public representation — never includes hash/plaintext. */
export interface ApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  rateLimitPerMin: number | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
  revokedAt: Date | null;
  createdById: string | null;
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // CRUD
  // =============================================
  async list(companyId: string): Promise<ApiKeyView[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return rows.map((r) => this.toView(r));
  }

  async findById(companyId: string, id: string): Promise<ApiKeyView> {
    const row = await this.prisma.apiKey.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException(`ApiKey ${id} not found`);
    return this.toView(row);
  }

  async create(
    companyId: string,
    createdById: string,
    dto: CreateApiKeyDto,
  ): Promise<IssuedApiKey> {
    const { plaintextKey, keyHash, keyPrefix } = this.generateKey();

    try {
      const row = await this.prisma.apiKey.create({
        data: {
          companyId,
          createdById,
          name: dto.name,
          keyHash,
          keyPrefix,
          scopes: dto.scopes ?? [],
          isActive: true,
          rateLimitPerMin: dto.rateLimitPerMin ?? null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
      this.audit(companyId, createdById, AuditAction.CREATE, row.id, {
        name: row.name,
        scopes: row.scopes,
        rateLimitPerMin: row.rateLimitPerMin,
      });
      return this.toIssued(row, plaintextKey);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Extremely unlikely collision on keyHash — retry once
        throw new BadRequestException('Key generation collision, please retry');
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    id: string,
    actorId: string,
    dto: UpdateApiKeyDto,
  ): Promise<ApiKeyView> {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException(`ApiKey ${id} not found`);

    const row = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.scopes !== undefined ? { scopes: dto.scopes } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.rateLimitPerMin !== undefined
          ? { rateLimitPerMin: dto.rateLimitPerMin }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
      },
    });
    this.audit(companyId, actorId, AuditAction.UPDATE, id, {
      oldValues: {
        name: existing.name,
        scopes: existing.scopes,
        isActive: existing.isActive,
        rateLimitPerMin: existing.rateLimitPerMin,
      },
      newValues: {
        name: row.name,
        scopes: row.scopes,
        isActive: row.isActive,
        rateLimitPerMin: row.rateLimitPerMin,
      },
    });
    return this.toView(row);
  }

  /** Revoke = soft delete. Key stops working immediately. */
  async revoke(companyId: string, id: string, actorId: string): Promise<{ success: true }> {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException(`ApiKey ${id} not found`);
    if (existing.revokedAt) return { success: true };

    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });
    this.audit(companyId, actorId, AuditAction.DELETE, id, { revoked: true });
    return { success: true };
  }

  /** Generate a fresh plaintext key + hash; old hash is replaced atomically. */
  async rotate(companyId: string, id: string, actorId: string): Promise<IssuedApiKey> {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException(`ApiKey ${id} not found`);
    if (!existing.isActive) {
      throw new BadRequestException('Cannot rotate a revoked/inactive key');
    }

    const { plaintextKey, keyHash, keyPrefix } = this.generateKey();
    const row = await this.prisma.apiKey.update({
      where: { id },
      data: { keyHash, keyPrefix, usageCount: 0, lastUsedAt: null },
    });
    this.audit(companyId, actorId, AuditAction.UPDATE, id, { rotated: true });
    return this.toIssued(row, plaintextKey);
  }

  // =============================================
  // HELPERS
  // =============================================
  private generateKey(): { plaintextKey: string; keyHash: string; keyPrefix: string } {
    const token = randomBytes(KEY_TOKEN_BYTES).toString('base64url');
    const plaintextKey = `${KEY_PREFIX}${token}`;
    const keyHash = createHash('sha256').update(plaintextKey).digest('hex');
    const keyPrefix = plaintextKey.slice(0, DISPLAY_PREFIX_LEN);
    return { plaintextKey, keyHash, keyPrefix };
  }

  private toView(row: ApiKey): ApiKeyView {
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes,
      isActive: row.isActive,
      rateLimitPerMin: row.rateLimitPerMin,
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      usageCount: row.usageCount,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
      createdById: row.createdById,
    };
  }

  private toIssued(row: ApiKey, plaintextKey: string): IssuedApiKey {
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes,
      isActive: row.isActive,
      rateLimitPerMin: row.rateLimitPerMin,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      plaintextKey,
    };
  }

  private audit(
    companyId: string,
    userId: string,
    action: AuditAction,
    resourceId: string,
    payload: Record<string, unknown>,
  ): void {
    this.prisma.auditLog
      .create({
        data: {
          companyId,
          userId,
          action,
          resource: RESOURCE,
          resourceId,
          newValues: payload as Prisma.InputJsonValue,
        },
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.debug(`Non-blocking: api-key audit failed: ${msg}`);
      });
  }
}
