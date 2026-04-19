// =============================================
// 🎯 GoalsService — unit tests (Session 45)
// =============================================
// Covers:
//   - periodRange ISO math (weekly/monthly, UTC)
//   - CRUD (tenant isolation, percentage validation, P2002 → BadRequest,
//     audit fire-and-forget)
//   - Leaderboard aggregation + composite ranking + tiebreaker
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GoalMetric, GoalPeriodType, Prisma, UserRole } from '@prisma/client';
import { GoalsService } from '../../src/modules/goals/goals.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(15000);

describe('GoalsService', () => {
  let service: GoalsService;

  const mockPrisma = {
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    call: { findMany: jest.fn() },
    aISuggestion: { findMany: jest.fn() },
    whatsappMessage: { findMany: jest.fn() },
    teamGoal: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // periodRange — UTC determinism
  // =============================================
  describe('periodRange', () => {
    it('WEEKLY: maps Wednesday to Monday 00:00Z, end = next Monday 00:00Z', () => {
      const anchor = new Date('2026-04-15T15:30:00Z'); // Wednesday
      const { periodStart, periodEnd } = service.periodRange(
        GoalPeriodType.WEEKLY,
        anchor,
      );
      expect(periodStart.toISOString()).toBe('2026-04-13T00:00:00.000Z');
      expect(periodEnd.toISOString()).toBe('2026-04-20T00:00:00.000Z');
    });

    it('WEEKLY: Monday 00:00Z is already the start', () => {
      const anchor = new Date('2026-04-13T00:00:00Z');
      const { periodStart } = service.periodRange(GoalPeriodType.WEEKLY, anchor);
      expect(periodStart.toISOString()).toBe('2026-04-13T00:00:00.000Z');
    });

    it('WEEKLY: Sunday 23:59Z maps to preceding Monday', () => {
      const anchor = new Date('2026-04-19T23:59:00Z'); // Sunday
      const { periodStart } = service.periodRange(GoalPeriodType.WEEKLY, anchor);
      expect(periodStart.toISOString()).toBe('2026-04-13T00:00:00.000Z');
    });

    it('MONTHLY: first of month inclusive, first of next month exclusive', () => {
      const anchor = new Date('2026-04-18T12:00:00Z');
      const { periodStart, periodEnd } = service.periodRange(
        GoalPeriodType.MONTHLY,
        anchor,
      );
      expect(periodStart.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(periodEnd.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });
  });

  // =============================================
  // create
  // =============================================
  describe('create', () => {
    it('rejects target > 100 for percentage metrics', async () => {
      await expect(
        service.create('co1', 'u-actor', {
          metric: GoalMetric.CONVERSION_RATE,
          target: 120,
          periodType: GoalPeriodType.WEEKLY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates userId belongs to tenant (tenant isolation)', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create('co1', 'u-actor', {
          metric: GoalMetric.CALLS_TOTAL,
          target: 20,
          periodType: GoalPeriodType.WEEKLY,
          userId: 'u-other-tenant',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'u-other-tenant',
            companyId: 'co1',
          }),
        }),
      );
    });

    it('creates team-wide goal (userId null) and writes audit (fire-and-forget)', async () => {
      mockPrisma.teamGoal.create.mockResolvedValueOnce({ id: 'g1' });
      const goal = await service.create('co1', 'u-actor', {
        metric: GoalMetric.CALLS_COMPLETED,
        target: 50,
        periodType: GoalPeriodType.WEEKLY,
      });
      expect(goal).toEqual({ id: 'g1' });
      expect(mockPrisma.teamGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'co1',
            userId: null,
            metric: GoalMetric.CALLS_COMPLETED,
            target: 50,
            createdById: 'u-actor',
          }),
        }),
      );
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE',
            resource: 'TEAM_GOAL',
            resourceId: 'g1',
          }),
        }),
      );
    });

    it('maps P2002 unique violation to BadRequestException (duplicate period)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      mockPrisma.teamGoal.create.mockRejectedValueOnce(prismaError);
      await expect(
        service.create('co1', 'u-actor', {
          metric: GoalMetric.CALLS_TOTAL,
          target: 10,
          periodType: GoalPeriodType.WEEKLY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rethrows unknown Prisma errors (no masking)', async () => {
      mockPrisma.teamGoal.create.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.create('co1', 'u-actor', {
          metric: GoalMetric.CALLS_TOTAL,
          target: 10,
          periodType: GoalPeriodType.WEEKLY,
        }),
      ).rejects.toThrow(/db down/);
    });
  });

  // =============================================
  // updateTarget / remove
  // =============================================
  describe('updateTarget', () => {
    it('throws NotFoundException when goal is from another tenant', async () => {
      mockPrisma.teamGoal.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.updateTarget('co1', 'g1', 'u-actor', { target: 30 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.teamGoal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'g1', companyId: 'co1' } }),
      );
    });

    it('updates target and writes audit with oldValues/newValues', async () => {
      mockPrisma.teamGoal.findFirst.mockResolvedValueOnce({
        id: 'g1',
        target: 10,
        metric: GoalMetric.CALLS_TOTAL,
      });
      mockPrisma.teamGoal.update.mockResolvedValueOnce({ id: 'g1', target: 30 });
      const result = await service.updateTarget('co1', 'g1', 'u-actor', {
        target: 30,
      });
      expect(result).toEqual({ id: 'g1', target: 30 });
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE',
            resource: 'TEAM_GOAL',
            resourceId: 'g1',
            oldValues: { target: 10 },
            newValues: { target: 30 },
          }),
        }),
      );
    });

    it('rejects target > 100 when metric is a percentage', async () => {
      mockPrisma.teamGoal.findFirst.mockResolvedValueOnce({
        id: 'g1',
        target: 80,
        metric: GoalMetric.AI_ADOPTION_RATE,
      });
      await expect(
        service.updateTarget('co1', 'g1', 'u-actor', { target: 150 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when goal is missing / tenant mismatch', async () => {
      mockPrisma.teamGoal.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove('co1', 'g1', 'u-actor')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes and writes audit', async () => {
      mockPrisma.teamGoal.findFirst.mockResolvedValueOnce({ id: 'g1' });
      mockPrisma.teamGoal.delete.mockResolvedValueOnce({});
      const result = await service.remove('co1', 'g1', 'u-actor');
      expect(result).toEqual({ success: true });
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELETE',
            resource: 'TEAM_GOAL',
            resourceId: 'g1',
          }),
        }),
      );
    });
  });

  // =============================================
  // leaderboard — aggregation + ranking
  // =============================================
  describe('leaderboard', () => {
    const users = [
      { id: 'u1', name: 'Alice', email: 'a@x', role: UserRole.VENDOR },
      { id: 'u2', name: 'Bob', email: 'b@x', role: UserRole.VENDOR },
      { id: 'u3', name: 'Cara', email: 'c@x', role: UserRole.VENDOR },
    ];

    it('returns empty rows when tenant has no active users', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);
      const result = await service.leaderboard('co1', GoalPeriodType.WEEKLY);
      expect(result.rows).toEqual([]);
      expect(result.period.type).toBe(GoalPeriodType.WEEKLY);
    });

    it('buckets calls, AI suggestions, and outgoing WhatsApp per user', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(users);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        { userId: 'u1', status: 'COMPLETED' },
        { userId: 'u1', status: 'COMPLETED' },
        { userId: 'u1', status: 'MISSED' },
        { userId: 'u2', status: 'COMPLETED' },
      ]);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([
        { userId: 'u1', wasUsed: true },
        { userId: 'u1', wasUsed: false },
        { userId: 'u2', wasUsed: true },
        { userId: 'u2', wasUsed: true },
      ]);
      mockPrisma.whatsappMessage.findMany.mockResolvedValueOnce([
        { chat: { userId: 'u1' } },
        { chat: { userId: 'u1' } },
        { chat: { userId: 'u2' } },
        { chat: { userId: null } }, // unassigned — skipped
      ]);
      mockPrisma.teamGoal.findMany.mockResolvedValueOnce([]);

      const result = await service.leaderboard('co1', GoalPeriodType.WEEKLY);

      const alice = result.rows.find((r) => r.userId === 'u1')!;
      const bob = result.rows.find((r) => r.userId === 'u2')!;
      const cara = result.rows.find((r) => r.userId === 'u3')!;

      expect(alice.metrics.callsTotal).toBe(3);
      expect(alice.metrics.callsCompleted).toBe(2);
      expect(alice.metrics.conversionRate).toBe(67); // 2/3 rounded
      expect(alice.metrics.aiSuggestionsShown).toBe(2);
      expect(alice.metrics.aiSuggestionsUsed).toBe(1);
      expect(alice.metrics.aiAdoptionRate).toBe(50);
      expect(alice.metrics.whatsappMessagesSent).toBe(2);

      expect(bob.metrics.callsCompleted).toBe(1);
      expect(bob.metrics.aiAdoptionRate).toBe(100);
      expect(bob.metrics.whatsappMessagesSent).toBe(1);

      expect(cara.metrics.callsTotal).toBe(0);
      expect(cara.metrics.conversionRate).toBe(0);
      expect(cara.metrics.aiAdoptionRate).toBe(0);
    });

    it('computes goal progress (cap 100) and composite score across per-user + team-wide goals', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([users[0]]);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        { userId: 'u1', status: 'COMPLETED' },
        { userId: 'u1', status: 'COMPLETED' },
        { userId: 'u1', status: 'COMPLETED' },
      ]);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([]);
      mockPrisma.whatsappMessage.findMany.mockResolvedValueOnce([]);
      mockPrisma.teamGoal.findMany.mockResolvedValueOnce([
        {
          id: 'g-user',
          userId: 'u1',
          metric: GoalMetric.CALLS_COMPLETED,
          target: 2,
        }, // 3/2 → capped 100
        {
          id: 'g-team',
          userId: null,
          metric: GoalMetric.CALLS_TOTAL,
          target: 6,
        }, // 3/6 → 50
      ]);

      const result = await service.leaderboard('co1', GoalPeriodType.WEEKLY);
      const alice = result.rows[0];
      expect(alice.goals).toHaveLength(2);
      const gUser = alice.goals.find((g) => g.id === 'g-user')!;
      const gTeam = alice.goals.find((g) => g.id === 'g-team')!;
      expect(gUser.progressPct).toBe(100);
      expect(gUser.isCompanyWide).toBe(false);
      expect(gTeam.progressPct).toBe(50);
      expect(gTeam.isCompanyWide).toBe(true);
      expect(alice.compositeScore).toBe(75); // avg(100, 50)
    });

    it('ranks by composite DESC then by callsCompleted as tiebreaker', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(users);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        { userId: 'u1', status: 'COMPLETED' },
        { userId: 'u1', status: 'COMPLETED' },
        { userId: 'u1', status: 'COMPLETED' },
        { userId: 'u2', status: 'COMPLETED' },
        { userId: 'u2', status: 'COMPLETED' },
        { userId: 'u3', status: 'COMPLETED' },
      ]);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([]);
      mockPrisma.whatsappMessage.findMany.mockResolvedValueOnce([]);
      // Same company-wide goal applies to everyone; u1 + u2 tie at 100, u3 at 50.
      mockPrisma.teamGoal.findMany.mockResolvedValueOnce([
        {
          id: 'g-team',
          userId: null,
          metric: GoalMetric.CALLS_COMPLETED,
          target: 2,
        },
      ]);

      const result = await service.leaderboard('co1', GoalPeriodType.WEEKLY);
      expect(result.rows.map((r) => r.userId)).toEqual(['u1', 'u2', 'u3']);
      expect(result.rows[0].compositeScore).toBe(100);
      expect(result.rows[1].compositeScore).toBe(100);
      expect(result.rows[0].metrics.callsCompleted).toBeGreaterThanOrEqual(
        result.rows[1].metrics.callsCompleted,
      );
    });

    it('scopes AISuggestion via userId IN tenant users (has no companyId column)', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([users[0]]);
      mockPrisma.call.findMany.mockResolvedValueOnce([]);
      mockPrisma.aISuggestion.findMany.mockResolvedValueOnce([]);
      mockPrisma.whatsappMessage.findMany.mockResolvedValueOnce([]);
      mockPrisma.teamGoal.findMany.mockResolvedValueOnce([]);

      await service.leaderboard('co1', GoalPeriodType.WEEKLY);

      expect(mockPrisma.aISuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: { in: ['u1'] },
          }),
        }),
      );
      expect(mockPrisma.whatsappMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            chat: { companyId: 'co1' },
            direction: 'OUTGOING',
          }),
        }),
      );
    });
  });
});
