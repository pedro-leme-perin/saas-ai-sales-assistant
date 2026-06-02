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

  // ===== Query filters ==================================================

  describe('query filters', () => {
    it('passes channel filter through to where', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        channel: CsatChannel.EMAIL,
      });
      expect(mockPrisma.csatResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ channel: CsatChannel.EMAIL }),
        }),
      );
    });

    it('passes trigger filter through to where', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        trigger: CsatTrigger.CALL_END,
      });
      expect(mockPrisma.csatResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ trigger: CsatTrigger.CALL_END }),
        }),
      );
    });

    it('does NOT add channel/trigger to where when omitted', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      const call = mockPrisma.csatResponse.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).not.toHaveProperty('channel');
      expect(call.where).not.toHaveProperty('trigger');
    });

    it('applies MAX_RESPONSES_PER_QUERY=10000 take cap', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(mockPrisma.csatResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10000 }),
      );
    });

    it('orders rows by createdAt asc (for stable bucket assignment)', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(mockPrisma.csatResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
      );
    });
  });

  // ===== Default window ================================================

  describe('default window', () => {
    it('defaults to 30 days when since/until omitted', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      const out = await service.getTrends('c1', {});
      const spanMs = out.window.until.getTime() - out.window.since.getTime();
      const days = Math.round(spanMs / 86_400_000);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('defaults bucket to day when omitted', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-15T00:00:00Z',
      });
      expect(out.window.bucket).toBe('day');
    });
  });

  // ===== Window validation extra =======================================

  describe('window validation (extra)', () => {
    it('rejects invalid until (NaN)', async () => {
      await expect(
        service.getTrends('c1', { since: '2026-04-10T00:00:00Z', until: 'rubbish' }),
      ).rejects.toThrow(/invalid until/);
    });

    it('rejects since equal to until (must be strictly less)', async () => {
      await expect(
        service.getTrends('c1', {
          since: '2026-04-10T00:00:00Z',
          until: '2026-04-10T00:00:00Z',
        }),
      ).rejects.toThrow(/<.*until/);
    });

    it('accepts exactly 180-day window', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      await expect(
        service.getTrends('c1', {
          since: '2026-01-01T00:00:00Z',
          until: '2026-06-30T00:00:00Z',
        }),
      ).resolves.toBeDefined();
    });
  });

  // ===== Hydration edge cases ==========================================

  describe('hydration', () => {
    it('returns call=null when rows have no callId', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5 }),
      ]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      // call.findMany should NOT be called when no callIds
      expect(mockPrisma.call.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.whatsappChat.findMany).not.toHaveBeenCalled();
    });

    it('hydrates call=null when callId exists but row not in DB (defensive)', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'missing-call' }),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([]); // empty result

      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'tag',
      });
      // (untagged) because no call.tags
      const untagged = out.breakdown!.find((b) => b.key === '(untagged)');
      expect(untagged?.responded).toBe(1);
    });

    it('de-duplicates callIds in hydration query (Set semantics)', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'call1' }),
        respondedRow({ id: 'r2', score: 4, callId: 'call1' }),
        respondedRow({ id: 'r3', score: 3, callId: 'call2' }),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        { id: 'call1', userId: 'u1', tags: [] },
        { id: 'call2', userId: 'u2', tags: [] },
      ]);

      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });

      const call = mockPrisma.call.findMany.mock.calls[0][0] as {
        where: { id: { in: string[] } };
      };
      // Should have only 2 unique ids, not 3
      expect(call.where.id.in).toHaveLength(2);
      expect(call.where.id.in.sort()).toEqual(['call1', 'call2']);
    });
  });

  // ===== Summary edge cases ============================================

  describe('summary (extra)', () => {
    it('responseRate is rounded to 1 decimal', async () => {
      const rows = [
        respondedRow({ id: 'r1', score: 5 }),
        respondedRow({ id: 'r2', score: 5 }),
        respondedRow({ id: 'r3', score: 5 }),
        {
          ...respondedRow({ id: 'r4', score: null as unknown as number }),
          status: CsatResponseStatus.SENT,
        },
        {
          ...respondedRow({ id: 'r5', score: null as unknown as number }),
          status: CsatResponseStatus.SENT,
        },
        {
          ...respondedRow({ id: 'r6', score: null as unknown as number }),
          status: CsatResponseStatus.SENT,
        },
        {
          ...respondedRow({ id: 'r7', score: null as unknown as number }),
          status: CsatResponseStatus.SENT,
        },
      ];
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce(rows);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      // 3 responded / 7 total = 42.857... -> 42.9
      expect(out.summary.responseRate).toBe(42.9);
    });

    it('excludes scores outside 1..5 from avgScore math', async () => {
      const rows = [
        respondedRow({ id: 'r1', score: 5 }),
        respondedRow({ id: 'r2', score: 0 as 1 }), // out of range
        respondedRow({ id: 'r3', score: 6 as 5 }), // out of range
      ];
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce(rows);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(out.summary.avgScore).toBe(5);
      expect(out.summary.distribution[5]).toBe(1);
    });

    it('NPS=100 when all promoters', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5 }),
        respondedRow({ id: 'r2', score: 5 }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(out.summary.nps).toBe(100);
    });

    it('NPS=-100 when all detractors', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 1 }),
        respondedRow({ id: 'r2', score: 2 }),
        respondedRow({ id: 'r3', score: 3 }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(out.summary.nps).toBe(-100);
    });

    it('NPS=0 when all passives (score=4)', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 4 }),
        respondedRow({ id: 'r2', score: 4 }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(out.summary.nps).toBe(0);
    });
  });

  // ===== Time series edge cases ========================================

  describe('time series (extra)', () => {
    it('falls back to createdAt when respondedAt is null', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        {
          ...respondedRow({ id: 'r1', score: 5 }),
          respondedAt: null,
          createdAt: new Date('2026-04-15T08:00:00Z'),
        },
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-13T00:00:00Z',
        until: '2026-04-17T00:00:00Z',
        bucket: 'day',
      });
      const d15 = out.timeSeries.find(
        (b) => b.bucketStart.toISOString() === '2026-04-15T00:00:00.000Z',
      );
      expect(d15?.responded).toBe(1);
    });

    it('week bucket: Sunday shifts to previous Monday', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({
          score: 5,
          respondedAt: new Date('2026-04-19T10:00:00Z'), // Sunday
          createdAt: new Date('2026-04-19T00:00:00Z'),
        }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-13T00:00:00Z', // Monday
        until: '2026-04-22T00:00:00Z',
        bucket: 'week',
      });
      // Sunday 19th → bucket starts Monday 13th (6-day shift)
      const wk13 = out.timeSeries.find(
        (b) => b.bucketStart.toISOString() === '2026-04-13T00:00:00.000Z',
      );
      expect(wk13?.responded).toBe(1);
    });

    it('month bucket spans Dec → Jan rollover correctly', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({
          score: 5,
          respondedAt: new Date('2026-01-15T10:00:00Z'),
          createdAt: new Date('2026-01-15T00:00:00Z'),
        }),
      ]);
      const out = await service.getTrends('c1', {
        since: '2025-12-15T00:00:00Z',
        until: '2026-01-31T00:00:00Z',
        bucket: 'month',
      });
      const dec = out.timeSeries.find(
        (b) => b.bucketStart.toISOString() === '2025-12-01T00:00:00.000Z',
      );
      const jan = out.timeSeries.find(
        (b) => b.bucketStart.toISOString() === '2026-01-01T00:00:00.000Z',
      );
      expect(dec).toBeDefined();
      expect(jan?.responded).toBe(1);
    });

    it('day bucket sorted ascending by bucketStart', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-15T00:00:00Z',
        bucket: 'day',
      });
      for (let i = 1; i < out.timeSeries.length; i++) {
        expect(out.timeSeries[i].bucketStart.getTime()).toBeGreaterThan(
          out.timeSeries[i - 1].bucketStart.getTime(),
        );
      }
    });

    it('returns empty timeSeries entries with zeros when no responses', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-12T00:00:00Z',
        bucket: 'day',
      });
      expect(out.timeSeries.length).toBeGreaterThanOrEqual(2);
      for (const b of out.timeSeries) {
        expect(b.responded).toBe(0);
        expect(b.avgScore).toBe(0);
        expect(b.nps).toBe(0);
      }
    });
  });

  // ===== Breakdown edge cases ==========================================

  describe('breakdown edge cases', () => {
    it('returns breakdown=null when groupBy omitted', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
      });
      expect(out.breakdown).toBeNull();
    });

    it('breakdown by channel skips rows with score=null', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, channel: CsatChannel.WHATSAPP }),
        {
          ...respondedRow({ id: 'r2', channel: CsatChannel.WHATSAPP }),
          score: null as unknown as number,
        },
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'channel',
      });
      const wa = out.breakdown!.find((b) => b.key === CsatChannel.WHATSAPP);
      expect(wa?.responded).toBe(1);
    });

    it('breakdown by tag sorted by responded desc', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'call1' }),
        respondedRow({ id: 'r2', score: 5, callId: 'call2' }),
        respondedRow({ id: 'r3', score: 4, callId: 'call3' }),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        { id: 'call1', userId: null, tags: ['popular'] },
        { id: 'call2', userId: null, tags: ['popular'] },
        { id: 'call3', userId: null, tags: ['niche'] },
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'tag',
      });
      expect(out.breakdown![0].key).toBe('popular');
      expect(out.breakdown![1].key).toBe('niche');
    });

    it('breakdown by agent: user.findMany NOT called when all unassigned', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5 }),
        respondedRow({ id: 'r2', score: 4 }),
      ]);
      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'agent',
      });
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('breakdown by agent: falls back to userId as label when user not in DB', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'call1' }),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([
        { id: 'call1', userId: 'missing-user', tags: [] },
      ]);
      mockPrisma.user.findMany.mockResolvedValueOnce([]); // user deleted
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'agent',
      });
      const missing = out.breakdown!.find((b) => b.key === 'missing-user');
      expect(missing?.label).toBe('missing-user');
    });

    it('breakdown by agent: user.findMany scoped by companyId', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'call1' }),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([{ id: 'call1', userId: 'u1', tags: [] }]);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'u1', name: 'Alice', email: 'a@x.com' },
      ]);

      await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'agent',
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1' }),
        }),
      );
    });

    it('breakdown by agent: prefers call.userId over chat.userId when both present', async () => {
      mockPrisma.csatResponse.findMany.mockResolvedValueOnce([
        respondedRow({ id: 'r1', score: 5, callId: 'call1', chatId: 'chat1' }),
      ]);
      mockPrisma.call.findMany.mockResolvedValueOnce([{ id: 'call1', userId: 'u-call', tags: [] }]);
      mockPrisma.whatsappChat.findMany.mockResolvedValueOnce([
        { id: 'chat1', userId: 'u-chat', tags: [] },
      ]);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'u-call', name: 'CallAgent', email: 'c@x.com' },
      ]);
      const out = await service.getTrends('c1', {
        since: '2026-04-10T00:00:00Z',
        until: '2026-04-20T00:00:00Z',
        groupBy: 'agent',
      });
      const callAgent = out.breakdown!.find((b) => b.key === 'u-call');
      expect(callAgent?.responded).toBe(1);
    });
  });
});
