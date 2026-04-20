// =============================================
// 📊 UsageQuotasService — unit tests (Session 55 — Feature A2)
// =============================================
// Covers:
//   - periodRange UTC determinism (month boundaries)
//   - getOrProvision: hit existing, provision from plan default, P2002 re-read
//   - recordUsage: unlimited short-circuit, increment, threshold event emission
//     for newly crossed steps, idempotent warnings (no re-emit)
//   - upsertLimit: create/update + threshold reconciliation on limit bump
//   - rolloverSanityPass: no-op when not day=1 hour=1, fires at 01:00 UTC on 1st
//   - checkQuota returns correct flags (isUnlimited/isNearLimit/isOverLimit)
// =============================================

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Plan, Prisma, UsageMetric } from '@prisma/client';

import {
  USAGE_THRESHOLD_EVENT,
  UsageQuotasService,
} from '../../src/modules/usage-quotas/usage-quotas.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('UsageQuotasService', () => {
  let service: UsageQuotasService;
  let emitter: EventEmitter2;

  const mockPrisma = {
    usageQuota: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsageQuotasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(UsageQuotasService);
    emitter = module.get(EventEmitter2);
  });

  const flushAudit = () => new Promise((r) => setImmediate(r));

  // ===== Period math ======================================================

  describe('periodRange', () => {
    it('anchors month boundaries in UTC', () => {
      const { start, end } = service.periodRange(new Date('2026-04-15T10:30:00Z'));
      expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('handles December→January rollover', () => {
      const { start, end } = service.periodRange(new Date('2026-12-20T00:00:00Z'));
      expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  // ===== getOrProvision ==================================================

  describe('getOrProvision', () => {
    it('returns existing row when found', async () => {
      const row = {
        id: 'q1',
        metric: UsageMetric.CALLS,
        limit: 500,
        currentValue: 0,
        warnedThresholds: [],
      };
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(row);
      const out = await service.getOrProvision('c1', UsageMetric.CALLS);
      expect(out).toEqual(row);
      expect(mockPrisma.usageQuota.create).not.toHaveBeenCalled();
    });

    it('provisions with plan default when missing', async () => {
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(null);
      mockPrisma.company.findUnique.mockResolvedValueOnce({ plan: Plan.PROFESSIONAL });
      mockPrisma.usageQuota.create.mockResolvedValueOnce({
        id: 'q1',
        metric: UsageMetric.CALLS,
        limit: 2_000,
        currentValue: 0,
        warnedThresholds: [],
      });
      const out = await service.getOrProvision('c1', UsageMetric.CALLS);
      expect(out.limit).toBe(2_000);
      expect(mockPrisma.usageQuota.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            metric: UsageMetric.CALLS,
            limit: 2_000,
            currentValue: 0,
          }),
        }),
      );
    });

    it('throws NotFound when company missing', async () => {
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(null);
      mockPrisma.company.findUnique.mockResolvedValueOnce(null);
      await expect(service.getOrProvision('c1', UsageMetric.CALLS)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('re-reads winner on P2002 concurrent race', async () => {
      const winner = {
        id: 'q1',
        metric: UsageMetric.CALLS,
        limit: 500,
        currentValue: 0,
        warnedThresholds: [],
      };
      mockPrisma.usageQuota.findUnique
        .mockResolvedValueOnce(null) // first check: missing
        .mockResolvedValueOnce(winner); // after P2002, re-read returns winner
      mockPrisma.company.findUnique.mockResolvedValueOnce({ plan: Plan.STARTER });
      mockPrisma.usageQuota.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      const out = await service.getOrProvision('c1', UsageMetric.CALLS);
      expect(out).toEqual(winner);
    });
  });

  // ===== recordUsage ====================================================

  describe('recordUsage', () => {
    it('unlimited (-1) short-circuits threshold logic', async () => {
      const row = {
        id: 'q1',
        metric: UsageMetric.CALLS,
        limit: -1,
        currentValue: 99_000,
        warnedThresholds: [],
      };
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(row);
      mockPrisma.usageQuota.update.mockResolvedValueOnce({ ...row, currentValue: 99_001 });
      await service.recordUsage('c1', UsageMetric.CALLS);
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('emits threshold event for newly-crossed 80%', async () => {
      const provisioned = {
        id: 'q1',
        metric: UsageMetric.CALLS,
        limit: 100,
        currentValue: 79,
        warnedThresholds: [],
        periodStart: new Date('2026-04-01T00:00:00Z'),
        periodEnd: new Date('2026-05-01T00:00:00Z'),
      };
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(provisioned);
      mockPrisma.usageQuota.update
        .mockResolvedValueOnce({ ...provisioned, currentValue: 80 }) // increment
        .mockResolvedValueOnce({ ...provisioned, currentValue: 80, warnedThresholds: [80] }); // persist warned

      await service.recordUsage('c1', UsageMetric.CALLS, 1);

      expect(emitter.emit).toHaveBeenCalledWith(
        USAGE_THRESHOLD_EVENT,
        expect.objectContaining({
          companyId: 'c1',
          metric: UsageMetric.CALLS,
          threshold: 80,
          used: 80,
          limit: 100,
        }),
      );
    });

    it('does not re-emit for already-warned threshold (idempotent)', async () => {
      const provisioned = {
        id: 'q1',
        metric: UsageMetric.CALLS,
        limit: 100,
        currentValue: 85,
        warnedThresholds: [80], // 80 already warned
        periodStart: new Date(),
        periodEnd: new Date(),
      };
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(provisioned);
      mockPrisma.usageQuota.update.mockResolvedValueOnce({ ...provisioned, currentValue: 86 });
      await service.recordUsage('c1', UsageMetric.CALLS);
      expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('emits all newly-crossed thresholds in a single jump', async () => {
      const provisioned = {
        id: 'q1',
        metric: UsageMetric.AI_SUGGESTIONS,
        limit: 100,
        currentValue: 70,
        warnedThresholds: [],
        periodStart: new Date(),
        periodEnd: new Date(),
      };
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(provisioned);
      mockPrisma.usageQuota.update
        .mockResolvedValueOnce({ ...provisioned, currentValue: 100 })
        .mockResolvedValueOnce({
          ...provisioned,
          currentValue: 100,
          warnedThresholds: [80, 95, 100],
        });

      await service.recordUsage('c1', UsageMetric.AI_SUGGESTIONS, 30);

      const emitted = (emitter.emit as jest.Mock).mock.calls.map((c) => c[1].threshold);
      expect(emitted).toEqual([80, 95, 100]);
    });
  });

  // ===== upsertLimit =====================================================

  describe('upsertLimit', () => {
    it('reconciles warnedThresholds when limit is raised', async () => {
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce({
        currentValue: 85,
        limit: 100,
        warnedThresholds: [80],
      });
      mockPrisma.usageQuota.upsert.mockResolvedValueOnce({
        id: 'q1',
        limit: 500,
        warnedThresholds: [],
      });
      await service.upsertLimit('c1', 'actor', UsageMetric.CALLS, 500);
      await flushAudit();
      const call = mockPrisma.usageQuota.upsert.mock.calls[0][0];
      // new pct = 85/500 = 17% → all thresholds reconciled away
      expect(call.update.warnedThresholds).toEqual([]);
    });

    it('creates row when missing', async () => {
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce(null);
      mockPrisma.usageQuota.upsert.mockResolvedValueOnce({ id: 'q1', limit: 1_000 });
      await service.upsertLimit('c1', 'actor', UsageMetric.CALLS, 1_000);
      const call = mockPrisma.usageQuota.upsert.mock.calls[0][0];
      expect(call.create.limit).toBe(1_000);
      expect(call.create.currentValue).toBe(0);
    });
  });

  // ===== checkQuota ======================================================

  describe('checkQuota', () => {
    it('returns isUnlimited=true for -1 limit', async () => {
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce({
        metric: UsageMetric.CALLS,
        currentValue: 1_000_000,
        limit: -1,
        warnedThresholds: [],
        periodStart: new Date(),
        periodEnd: new Date(),
      });
      const out = await service.checkQuota('c1', UsageMetric.CALLS);
      expect(out.isUnlimited).toBe(true);
      expect(out.pct).toBe(0);
      expect(out.isNearLimit).toBe(false);
      expect(out.isOverLimit).toBe(false);
    });

    it('returns isNearLimit true at 80-99%', async () => {
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce({
        metric: UsageMetric.CALLS,
        currentValue: 85,
        limit: 100,
        warnedThresholds: [80],
        periodStart: new Date(),
        periodEnd: new Date(),
      });
      const out = await service.checkQuota('c1', UsageMetric.CALLS);
      expect(out.isNearLimit).toBe(true);
      expect(out.isOverLimit).toBe(false);
    });

    it('returns isOverLimit true at 100%+', async () => {
      mockPrisma.usageQuota.findUnique.mockResolvedValueOnce({
        metric: UsageMetric.CALLS,
        currentValue: 120,
        limit: 100,
        warnedThresholds: [80, 95, 100],
        periodStart: new Date(),
        periodEnd: new Date(),
      });
      const out = await service.checkQuota('c1', UsageMetric.CALLS);
      expect(out.isOverLimit).toBe(true);
      expect(out.pct).toBe(120);
    });
  });

  // ===== rolloverSanityPass =============================================

  describe('rolloverSanityPass', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('no-op when not day=1 hour=1 UTC', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-15T14:00:00Z'));
      await service.rolloverSanityPass();
      expect(mockPrisma.company.findMany).not.toHaveBeenCalled();
    });

    it('fires when day=1 hour=1 UTC', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T01:30:00Z'));
      mockPrisma.company.findMany.mockResolvedValueOnce([{ id: 'c1', plan: Plan.STARTER }]);
      mockPrisma.usageQuota.upsert.mockResolvedValue({});
      await service.rolloverSanityPass();
      expect(mockPrisma.company.findMany).toHaveBeenCalled();
      // 4 metrics × 1 company = 4 upsert calls
      expect(mockPrisma.usageQuota.upsert).toHaveBeenCalledTimes(4);
    });
  });
});
