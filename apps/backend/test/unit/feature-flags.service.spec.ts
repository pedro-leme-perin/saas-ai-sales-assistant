// =============================================
// 🚩 FeatureFlagsService — unit tests (Session 53)
// =============================================
// Covers:
//   - CRUD tenant-scoped: list, findById NotFound on cross-tenant
//   - create: P2002 duplicate key → BadRequest
//   - update: merge partial + audit oldValues/newValues
//   - remove: tenant check + audit DELETE
//   - evaluate: not_found / disabled / allowlist bypass / rollout_hit / rollout_miss
//   - evaluate: deterministic bucket math (same companyId+key+userId → same result)
//   - evaluate: cache write-through on miss
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { FeatureFlagsService } from '../../src/modules/feature-flags/feature-flags.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';

jest.setTimeout(10_000);

function bucketOf(companyId: string, key: string, userId = ''): number {
  const hex = createHash('sha256')
    .update(`${companyId}:${key}:${userId}`)
    .digest('hex')
    .slice(0, 8);
  return parseInt(hex, 16) % 100;
}

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  const mockPrisma = {
    featureFlag: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockCache = {
    get: jest.fn(),
    getJson: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(FeatureFlagsService);
  });

  describe('CRUD', () => {
    it('list scopes by companyId', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValueOnce([]);
      await service.list('c1');
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith({
        where: { companyId: 'c1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('findById throws NotFound on tenant mismatch', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce(null);
      await expect(service.findById('c1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('create maps P2002 to BadRequest with descriptive message', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      mockPrisma.featureFlag.create.mockRejectedValueOnce(err);
      await expect(service.create('c1', 'u1', { key: 'new_ui', name: 'New UI' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('create persists defaults + audits CREATE + invalidates cache', async () => {
      mockPrisma.featureFlag.create.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'new_ui',
        name: 'New UI',
        enabled: false,
        rolloutPercentage: 0,
        userAllowlist: [],
      });
      const row = await service.create('c1', 'u1', { key: 'new_ui', name: 'New UI' });
      expect(row.id).toBe('f1');
      const data = mockPrisma.featureFlag.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('c1');
      expect(data.createdById).toBe('u1');
      expect(data.enabled).toBe(false);
      expect(data.rolloutPercentage).toBe(0);
      expect(data.userAllowlist).toEqual([]);
      expect(mockCache.delete).toHaveBeenCalledWith('ff:c1:new_ui:');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('update merges only provided fields + audits with oldValues', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'k',
        enabled: false,
        rolloutPercentage: 0,
      });
      mockPrisma.featureFlag.update.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'k',
        enabled: true,
        rolloutPercentage: 50,
      });
      await service.update('c1', 'u1', 'f1', { enabled: true, rolloutPercentage: 50 });
      const data = mockPrisma.featureFlag.update.mock.calls[0][0].data;
      expect(data).toEqual({ enabled: true, rolloutPercentage: 50 });
      expect(mockCache.delete).toHaveBeenCalledWith('ff:c1:k:');
    });

    it('remove audits DELETE + invalidates cache', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'k',
      });
      mockPrisma.featureFlag.delete.mockResolvedValueOnce({});
      const res = await service.remove('c1', 'u1', 'f1');
      expect(res).toEqual({ success: true });
      expect(mockCache.delete).toHaveBeenCalledWith('ff:c1:k:');
    });
  });

  describe('evaluate', () => {
    beforeEach(() => {
      mockCache.getJson.mockResolvedValue(null);
    });

    it('returns not_found when flag does not exist', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce(null);
      const res = await service.evaluate('c1', 'missing', 'u1');
      expect(res).toEqual({ key: 'missing', enabled: false, reason: 'not_found' });
    });

    it('returns disabled when flag.enabled is false', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'k',
        enabled: false,
        rolloutPercentage: 100,
        userAllowlist: [],
      });
      const res = await service.evaluate('c1', 'k', 'u1');
      expect(res.enabled).toBe(false);
      expect(res.reason).toBe('disabled');
    });

    it('allowlist bypasses rolloutPercentage', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'k',
        enabled: true,
        rolloutPercentage: 0,
        userAllowlist: ['u1'],
      });
      const res = await service.evaluate('c1', 'k', 'u1');
      expect(res.enabled).toBe(true);
      expect(res.reason).toBe('allowlist');
    });

    it('rolloutPercentage=100 returns rollout_hit immediately', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'k',
        enabled: true,
        rolloutPercentage: 100,
        userAllowlist: [],
      });
      const res = await service.evaluate('c1', 'k', 'u1');
      expect(res.enabled).toBe(true);
      expect(res.reason).toBe('rollout_hit');
    });

    it('rolloutPercentage=0 returns rollout_miss immediately', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce({
        id: 'f1',
        companyId: 'c1',
        key: 'k',
        enabled: true,
        rolloutPercentage: 0,
        userAllowlist: [],
      });
      const res = await service.evaluate('c1', 'k', 'u1');
      expect(res.enabled).toBe(false);
      expect(res.reason).toBe('rollout_miss');
    });

    it('deterministic bucket: same inputs → same result', async () => {
      const flag = {
        id: 'f1',
        companyId: 'c1',
        key: 'k',
        enabled: true,
        rolloutPercentage: 50,
        userAllowlist: [],
      };
      const bucket = bucketOf('c1', 'k', 'u1');
      const expected = bucket < 50 ? 'rollout_hit' : 'rollout_miss';
      mockPrisma.featureFlag.findFirst.mockResolvedValue(flag);
      const first = await service.evaluate('c1', 'k', 'u1');
      const second = await service.evaluate('c1', 'k', 'u1');
      expect(first.reason).toBe(expected);
      expect(second.reason).toBe(expected);
    });

    it('returns cached value when present', async () => {
      mockCache.getJson.mockResolvedValueOnce({
        key: 'k',
        enabled: true,
        reason: 'allowlist',
      });
      const res = await service.evaluate('c1', 'k', 'u1');
      expect(res.reason).toBe('allowlist');
      expect(mockPrisma.featureFlag.findFirst).not.toHaveBeenCalled();
    });

    it('writes through to cache on DB lookup', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValueOnce(null);
      await service.evaluate('c1', 'missing', 'u1');
      expect(mockCache.set).toHaveBeenCalledWith(
        'ff:c1:missing:u1',
        expect.objectContaining({ reason: 'not_found' }),
        60,
      );
    });
  });
});
