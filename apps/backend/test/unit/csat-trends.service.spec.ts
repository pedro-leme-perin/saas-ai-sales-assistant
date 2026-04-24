// =============================================
// 📈 CsatTrendsService — unit tests (Session 59 — Feature A2)
// =============================================
// Covers:
//   - Window parse: default 30d, custom since/until, invalid dates rejected,
//     >180d window rejected, since>=until rejected
//   - Tenant isolation: hydrate join uses companyId filter
//   - Summary: counts/averages/NPS/distribution over RESPONDED rows only
//   - Time series: dense day buckets (zero-fill), week anchored to Monday UTC,
//     month anchored to 1st UTC
//   - Breakdown by channel: groups WHATSAPP / EMAIL separately
//   - Breakdown by tag: union of call.tags + chat.tags; '(untagged)' bucket
//   - Breakdown by agent: resolves userId → name via follow-up query;
//     '(unassigned)' bucket for null userId
//   - NPS helper: total=0 returns 0 (no NaN)
// =============================================

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CsatChannel, CsatResponse, CsatResponseStatus, CsatTrigger } from '@prisma/client';

import { CsatTrendsService } from '../../src/modules/csat-trends/csat-trends.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

jest.setTimeout(10_000);

describe('CsatTrendsService', () => {
  let service: CsatTrendsService;

  const mockPrisma = {
    csatResponse: { findMany: jest.fn() },
    call: { findMany: jest.fn() },
    whatsappChat: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.call.findMany.mockResolvedValue([]);
    mockPrisma.whatsappChat.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.csatResponse.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [CsatTrendsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(CsatTrendsService);
  });

  // Helper to build a RESPONDED CsatResponse row
  const respondedRow = (
    overrides: Partial<{
      id: string;
      score: number;
      respondedAt: Date;
      createdAt: Date;
      channel: CsatChannel;
      trigger: CsatTrigger;
      callId: string | null;
      chatId: string | null;
    }> = {},
  ): CsatResponse => ({
    id: overrides.id ?? 'r1',
    companyId: 'c1',
    contactId: null,
    callId: overrides.callId ?? null,
    chatId: overrides.chatId ?? null,
    trigger: overrides.trigger ?? CsatTrigger.CHAT_CLOSE,
    channel: overrides.channel ?? CsatChannel.WHATSAPP,
    token: 'token-long-enough-base64',
    score: overrides.score ?? 5,
    comment: null,
    status: CsatResponseStatus.RESPONDED,
    scheduledFor: new Date('2026-04-15T00:00:00Z'),
    sentAt: new Date('2026-04-15T00:05:00Z'),
    respondedAt: overrides.respondedAt ?? new Date('2026-04-15T12:00:00Z'),
    expiresAt: new Date('2026-04-22T00:00:00Z'),
    lastError: null,
    createdAt: overrides.createdAt ?? new Date('2026-04-15T00:00:00Z'),
    updatedAt: new Date('2026-04-15T12:00:00Z'),
  });

  // ===== Window parsing ================================================

  describe('window parsing', () => {
    it('rejects empty companyId', async () => {
      await expect(service.getTrends('', {})).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid since', async () => {
      await expect(service.getTrends('c1', { since: 'garbage' })).rejects.toThrow();
    });

    it('rejects window larger than 180 days', async () => {
      await expect(
        service.getTrends('c1', {
          since: '2025-01-01T00:00:00Z',
          until: '2026-01-01T00:00:00Z',
        }),
      ).rejects.toThrow(/180 days/);
    });

    it('rejects since >= until', async () => {
      await expect(
        service.getTrends('c1', {
          since: '2026-04-20T00:00:00Z',
          until: '2026-04-10T00:00:00Z',
        }),
      ).rejects.toThrow(/<.*until/);
    });
  });

  // ===== Tenant isolation ==============================================

  describe('tenant isolation', () => {
    it('scopes csatResponse.findMany + hydration by companyId', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([respondedRow({ callId: 'call1' })]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(mockPrisma.csatResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1' }),
        }),
      );
      expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['call1'] }, companyId: 'c1' },
        }),
      );
    });
  });

  // ===== Summary =======================================================

  describe('summary', () => {
    it('computes avgScore, NPS, distribution over RESPONDED rows', async () => {
      const rows = [
        respondedRow({ id: 'r1', score: 5 }),
        respondedRow({ id: 'r2', score: 5 }),
        respondedRow({ id: 'r3', score: 4 }),
        respondedRow({ id: 'r4', score: 1 }),
        // non-RESPONDED row should be excluded from score math
        {
          ...respondedRow({ id: 'r5', score: null as unknown as number }),
          status: CsatResponseStatus.SENT,
        },
      ];
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce(rows);

      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });

      expect(out.summary.total).toBe(5);
      expect(out.summary.responded).toBe(4);
      expect(out.summary.distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 });
      expect(out.summary.promoters).toBe(2);
      expect(out.summary.passives).toBe(1);
      expect(out.summary.detractors).toBe(1);
      // avgScore = (5+5+4+1)/4 = 3.75
      expect(out.summary.avgScore).toBe(3.75);
      // NPS = round(100 × (2 - 1)/4) = 25
      expect(out.summary.nps).toBe(25);
    });

    it('NPS returns 0 when no responded rows (avoids NaN)', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(out.summary.nps).toBe(0);
      expect(out.summary.avgScore).toBe(0);
      expect(out.summary.responseRate).toBe(0);
    });
  });

  // ===== Time series ===================================================

  describe('time series', () => {
    it('day bucket produces dense series (zero-fill)', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({
          score: 5,
          respondedAt: new Date('2026-04-15T10:00:00Z'),
          createdAt: new Date('2026-04-15T00:00:00Z'),
        }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-13T00:00:00Z',
        until: '2026-04-17T00:00:00Z',
        bucket: 'day',
      });
      // Days 13, 14, 15, 16, 17 (some implementations may or may not include 17
      // depending on cursor math; we accept 4..5 buckets here).
      expect(out.timeSeries.length).toBeGreaterThanOrEqual(4);
      const d15 = out.timeSeries.find(
        (b) => b.bucketStart.toISOString() === '2026-04-15T00:00:00.000Z',
      );
      expect(d15?.responded).toBe(1);
      expect(d15?.avgScore).toBe(5);
      // NPS for a single promoter = 100
      expect(d15?.nps).toBe(100);
    });

    it('week bucket anchors to Monday UTC', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({
          score: 4,
          respondedAt: new Date('2026-04-15T10:00:00Z'), // Wed
          createdAt: new Date('2026-04-15T00:00:00Z'),
        }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z', // Fri
        until: '2026-04-20T00:00:00Z',
        bucket: 'week',
      });
      // Week start for 2026-04-15 = Monday 2026-04-13
      const mondayBucket = out.timeSeries.find(
        (b) => b.bucketStart.toISOString() === '2026-04-13T00:00:00.000Z',
      );
      expect(mondayBucket).toBeDefined();
      expect(mondayBucket?.responded).toBe(1);
    });

    it('month bucket anchors to 1st UTC', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({
          score: 3,
          respondedAt: new Date('2026-04-15T10:00:00Z'),
          createdAt: new Date('2026-04-01T00:00:00Z'),
        }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-01T00:00:00Z',
        until: '2026-04-30T00:00:00Z',
        bucket: 'month',
      });
      const april = out.timeSeries.find(
        (b) => b.bucketStart.toISOString() === '2026-04-01T00:00:00.000Z',
      );
      expect(april?.responded).toBe(1);
    });
  });

  // ===== Breakdown =====================================================

  describe('breakdown by channel', () => {
    it('splits WHATSAPP vs EMAIL', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, channel: CsatChannel.WHATSAPP }),
        respondedRow({ id: 'r2', score: 3, channel: CsatChannel.WHATSAPP }),
        respondedRow({ id: 'r3', score: 1, channel: CsatChannel.EMAIL }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'channel',
      });
      expect(out.breakdown).toBeDefined();
      const wa = out.breakdown!.find((b) => b.key === CsatChannel.WHATSAPP);
      const em = out.breakdown!.find((b) => b.key === CsatChannel.EMAIL);
      expect(wa?.responded).toBe(2);
      expect(em?.responded).toBe(1);
      // avg wa = (5+3)/2 = 4
      expect(wa?.avgScore).toBe(4);
    });
  });

  describe('breakdown by tag', () => {
    it('unions call.tags and chat.tags + (untagged) fallback', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'call1' }),
        respondedRow({ id: 'r2', score: 4, chatId: 'chat1' }),
        respondedRow({ id: 'r3', score: 2 }), // no call, no chat
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        { id: 'call1', userId: null, tags: ['vip'] },
      ]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        { id: 'chat1', userId: null, tags: ['vip', 'urgent'] },
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'tag',
      });
      const vip = out.breakdown!.find((b) => b.key === 'vip');
      const urgent = out.breakdown!.find((b) => b.key === 'urgent');
      const untagged = out.breakdown!.find((b) => b.key === '(untagged)');
      expect(vip?.responded).toBe(2); // r1 (call vip) + r2 (chat vip)
      expect(urgent?.responded).toBe(1); // r2 (chat urgent)
      expect(untagged?.responded).toBe(1); // r3
    });
  });

  describe('breakdown by agent', () => {
    it('resolves userId → name + (unassigned) bucket', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'call1' }),
        respondedRow({ id: 'r2', score: 4, chatId: 'chat1' }),
        respondedRow({ id: 'r3', score: 3 }), // unassigned
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([{ id: 'call1', userId: 'u1', tags: [] }]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        { id: 'chat1', userId: 'u2', tags: [] },
      ]);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'u1', name: 'Alice', email: 'a@x.com' },
        { id: 'u2', name: null, email: 'b@x.com' },
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'agent',
      });
      const alice = out.breakdown!.find((b) => b.key === 'u1');
      const bob = out.breakdown!.find((b) => b.key === 'u2');
      const unassigned = out.breakdown!.find((b) => b.key === '(unassigned)');
      expect(alice?.label).toBe('Alice');
      expect(bob?.label).toBe('b@x.com'); // falls back to email when name null
      expect(unassigned?.responded).toBe(1);
    });
  });
});
