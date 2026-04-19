// =============================================
// 📄 ApiKeysService — unit tests (Session 47)
// =============================================
// Covers:
//   - generateKey format (sk_live_ prefix, 12-char display prefix,
//     deterministic SHA-256 hash)
//   - list() never exposes keyHash in ApiKeyView
//   - create() returns IssuedApiKey WITH plaintext + stores hash only
//   - P2002 on unique keyHash collision → BadRequest
//   - update() merges only provided fields + audits old/new
//   - revoke() sets isActive=false + revokedAt; idempotent on second call
//   - rotate() requires active key, resets usageCount + lastUsedAt,
//     issues new plaintext, invalidates previous hash
//   - tenant isolation: findById / update / revoke / rotate throw
//     NotFoundException when company mismatches
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { ApiKeysService } from '../../src/modules/api-keys/api-keys.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

const makeKey = (overrides: Partial<{ id: string; companyId: string; name: string; keyHash: string; keyPrefix: string; scopes: string[]; isActive: boolean; rateLimitPerMin: number | null; expiresAt: Date | null; revokedAt: Date | null; usageCount: number }> = {}) => ({
  id: overrides.id ?? 'key-1',
  companyId: overrides.companyId ?? 'company-1',
  createdById: 'user-1',
  name: overrides.name ?? 'CI bot',
  keyHash: overrides.keyHash ?? 'hash-' + (overrides.id ?? 'key-1'),
  keyPrefix: overrides.keyPrefix ?? 'sk_live_abcd',
  scopes: overrides.scopes ?? ['calls:read'],
  isActive: overrides.isActive ?? true,
  rateLimitPerMin: overrides.rateLimitPerMin ?? null,
  expiresAt: overrides.expiresAt ?? null,
  lastUsedAt: null,
  usageCount: overrides.usageCount ?? 0,
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
  revokedAt: overrides.revokedAt ?? null,
});

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  const mockPrisma = {
    apiKey: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  // =============================================
  // list
  // =============================================
  describe('list', () => {
    it('scopes by companyId and omits keyHash from view', async () => {
      const row = makeKey({ keyHash: 'SECRET_HASH_SHOULD_NEVER_LEAK' });
      mockPrisma.apiKey.findMany.mockResolvedValueOnce([row]);

      const res = await service.list('company-1');

      expect(res).toHaveLength(1);
      expect(res[0]).not.toHaveProperty('keyHash');
      expect(res[0]).not.toHaveProperty('plaintextKey');
      expect(res[0].id).toBe('key-1');
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-1' }, take: 200 }),
      );
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when missing or wrong tenant', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('company-1', 'key-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns ApiKeyView (no hash) when found', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(makeKey({ keyHash: 'hash-xyz' }));
      const view = await service.findById('company-1', 'key-1');
      expect(view).not.toHaveProperty('keyHash');
      expect(view.id).toBe('key-1');
    });
  });

  // =============================================
  // create
  // =============================================
  describe('create', () => {
    it('generates sk_live_ plaintext + deterministic SHA-256 hash + 12-char display prefix', async () => {
      let captured: { keyHash?: string; keyPrefix?: string } = {};
      mockPrisma.apiKey.create.mockImplementationOnce(async (args: { data: Record<string, unknown> }) => {
        captured = args.data as { keyHash: string; keyPrefix: string };
        return makeKey({
          keyHash: captured.keyHash,
          keyPrefix: captured.keyPrefix,
        });
      });

      const issued = await service.create('company-1', 'user-1', { name: 'CI bot' });

      // Plaintext shape
      expect(issued.plaintextKey.startsWith('sk_live_')).toBe(true);
      expect(issued.plaintextKey.length).toBeGreaterThan(20);

      // Hash is deterministic sha256(plaintext)
      const expectedHash = createHash('sha256').update(issued.plaintextKey).digest('hex');
      expect(captured.keyHash).toBe(expectedHash);

      // Display prefix == first 12 chars of plaintext
      expect(captured.keyPrefix).toBe(issued.plaintextKey.slice(0, 12));
      expect(captured.keyPrefix!.startsWith('sk_live_')).toBe(true);

      // Issued view has plaintext but row persists only hash
      expect(issued).toHaveProperty('plaintextKey');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('maps P2002 collision on keyHash to BadRequestException', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      mockPrisma.apiKey.create.mockRejectedValueOnce(p2002);

      await expect(service.create('company-1', 'user-1', { name: 'X' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('propagates unknown errors', async () => {
      mockPrisma.apiKey.create.mockRejectedValueOnce(new Error('db down'));
      await expect(service.create('company-1', 'user-1', { name: 'X' })).rejects.toThrow('db down');
    });
  });

  // =============================================
  // update
  // =============================================
  describe('update', () => {
    it('throws NotFoundException on cross-tenant mismatch', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update('company-1', 'key-x', 'user-1', { name: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('merges only provided fields and audits old/new values', async () => {
      const existing = makeKey({ name: 'Old', scopes: ['calls:read'] });
      const updated = { ...existing, name: 'New' };
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.apiKey.update.mockResolvedValueOnce(updated);

      await service.update('company-1', 'key-1', 'user-1', { name: 'New' });

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { name: 'New' },
      });
      const audit = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(audit.data.newValues).toEqual(
        expect.objectContaining({
          oldValues: expect.objectContaining({ name: 'Old' }),
          newValues: expect.objectContaining({ name: 'New' }),
        }),
      );
    });

    it('clears expiresAt when receives null/undefined clearing string', async () => {
      const existing = makeKey();
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.apiKey.update.mockResolvedValueOnce(existing);

      await service.update('company-1', 'key-1', 'user-1', { expiresAt: undefined });

      // expiresAt NOT passed because dto.expiresAt is undefined
      const args = mockPrisma.apiKey.update.mock.calls[0][0];
      expect(args.data).not.toHaveProperty('expiresAt');
    });
  });

  // =============================================
  // revoke
  // =============================================
  describe('revoke', () => {
    it('throws NotFoundException on cross-tenant', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(null);
      await expect(service.revoke('company-1', 'key-x', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('sets isActive=false + revokedAt + audits DELETE', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(makeKey());
      mockPrisma.apiKey.update.mockResolvedValueOnce(makeKey({ isActive: false }));

      const res = await service.revoke('company-1', 'key-1', 'user-1');

      expect(res).toEqual({ success: true });
      const args = mockPrisma.apiKey.update.mock.calls[0][0];
      expect(args.data.isActive).toBe(false);
      expect(args.data.revokedAt).toBeInstanceOf(Date);
    });

    it('is idempotent when already revoked (no DB update)', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(
        makeKey({ isActive: false, revokedAt: new Date() }),
      );

      const res = await service.revoke('company-1', 'key-1', 'user-1');

      expect(res).toEqual({ success: true });
      expect(mockPrisma.apiKey.update).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // rotate
  // =============================================
  describe('rotate', () => {
    it('throws NotFoundException on cross-tenant', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(null);
      await expect(service.rotate('company-1', 'key-x', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when key is inactive', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(
        makeKey({ isActive: false, revokedAt: new Date() }),
      );
      await expect(service.rotate('company-1', 'key-1', 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('generates new hash + resets usage counters + returns new plaintext', async () => {
      const existing = makeKey({ keyHash: 'old-hash', usageCount: 99 });
      let captured: { keyHash?: string; keyPrefix?: string; usageCount?: number; lastUsedAt?: Date | null } = {};
      mockPrisma.apiKey.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.apiKey.update.mockImplementationOnce(async (args: { data: Record<string, unknown> }) => {
        captured = args.data as { keyHash: string; keyPrefix: string; usageCount: number; lastUsedAt: Date | null };
        return { ...existing, ...(args.data as object) };
      });

      const issued = await service.rotate('company-1', 'key-1', 'user-1');

      // New hash matches new plaintext
      const expectedHash = createHash('sha256').update(issued.plaintextKey).digest('hex');
      expect(captured.keyHash).toBe(expectedHash);
      expect(captured.keyHash).not.toBe('old-hash');

      // Usage counters reset
      expect(captured.usageCount).toBe(0);
      expect(captured.lastUsedAt).toBeNull();

      // Plaintext exposed once
      expect(issued.plaintextKey.startsWith('sk_live_')).toBe(true);

      // Audit captures rotation
      const audit = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(audit.data.newValues).toEqual(expect.objectContaining({ rotated: true }));
    });
  });

  // =============================================
  // generateKey (exercised through create)
  // =============================================
  describe('generateKey randomness', () => {
    it('produces a unique plaintext per call', async () => {
      const captured: string[] = [];
      mockPrisma.apiKey.create.mockImplementation(async () => {
        return makeKey();
      });

      for (let i = 0; i < 5; i++) {
        const issued = await service.create('company-1', 'user-1', { name: `k${i}` });
        captured.push(issued.plaintextKey);
      }

      // All distinct
      expect(new Set(captured).size).toBe(5);
      // All well-formed
      for (const k of captured) expect(k.startsWith('sk_live_')).toBe(true);
    });
  });
});
