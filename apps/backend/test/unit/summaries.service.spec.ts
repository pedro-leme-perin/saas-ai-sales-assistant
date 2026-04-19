// =============================================
// 🧠 SummariesService — unit tests (Session 44)
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SummariesService } from '../../src/modules/summaries/summaries.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/cache/cache.service';

// ------------------------------------------------------------------
// Mock OpenAI — we import the module shape inline.
// ------------------------------------------------------------------
const mockCreate = jest.fn();
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
);

jest.setTimeout(15000);

describe('SummariesService', () => {
  let service: SummariesService;

  const mockPrisma = {
    call: { findFirst: jest.fn(), findUnique: jest.fn() },
    whatsappChat: { findFirst: jest.fn() },
    whatsappMessage: { findMany: jest.fn() },
    callSummary: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockCache = {
    getJson: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
  };

  const mockConfigValues: Record<string, string> = {
    OPENAI_API_KEY: 'test_key',
    OPENAI_MODEL: 'gpt-4o-mini',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.set.mockResolvedValue(true);
    mockPrisma.auditLog.create.mockResolvedValue({});
    // Session 45 — durable DB check must default to miss so S44 tests pass.
    mockPrisma.callSummary.findUnique.mockResolvedValue(null);
    mockPrisma.callSummary.findFirst.mockResolvedValue(null);
    mockPrisma.callSummary.upsert.mockResolvedValue({});

    const mockEventEmitter = { emit: jest.fn().mockReturnValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummariesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => mockConfigValues[k]) },
        },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<SummariesService>(SummariesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================
  // summarizeCall — source loader + pipeline
  // =============================================
  describe('summarizeCall', () => {
    it('throws NotFoundException when call missing', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce(null);
      await expect(service.summarizeCall('cx', 'co1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when transcript empty', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: '   ',
        phoneNumber: '+55...',
        duration: 42,
      });
      await expect(service.summarizeCall('c1', 'co1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('enforces tenant isolation via companyId filter', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce(null);
      await expect(service.summarizeCall('c1', 'co1', 'u1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.call.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1', companyId: 'co1' } }),
      );
    });

    it('cache HIT returns cached summary without LLM call', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: 'Cliente pediu orçamento para 100 unidades.',
        phoneNumber: '+55119',
        duration: 120,
      });
      const cached = {
        keyPoints: ['cp1'],
        sentimentTimeline: [{ position: 0.5, sentiment: 'neutral' as const }],
        nextBestAction: 'Follow-up amanhã.',
        generatedAt: '2026-04-18T00:00:00Z',
        cached: false,
        provider: 'openai',
      };
      mockCache.getJson.mockResolvedValueOnce(cached);

      const result = await service.summarizeCall('c1', 'co1', 'u1');

      expect(result.cached).toBe(true);
      expect(result.keyPoints).toEqual(['cp1']);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('cache MISS invokes OpenAI, caches result, and writes audit (fire-and-forget)', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: 'Transcript completa da ligação.',
        phoneNumber: '+5511',
        duration: 300,
      });
      mockCache.getJson.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPoints: ['Cliente quer 100 unidades', 'Prazo 15 dias', 'Orçamento R$ 50k'],
                sentimentTimeline: [
                  { position: 0, sentiment: 'neutral' },
                  { position: 0.5, sentiment: 'positive' },
                  { position: 1, sentiment: 'positive' },
                ],
                nextBestAction: 'Enviar proposta formal até amanhã.',
              }),
            },
          },
        ],
      });

      const result = await service.summarizeCall('c1', 'co1', 'u1');

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalled();
      expect(result.cached).toBe(false);
      expect(result.keyPoints).toHaveLength(3);
      expect(result.provider).toBe('openai');

      // Flush fire-and-forget audit promise.
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'READ',
            resource: 'CALL',
            resourceId: 'c1',
            userId: 'u1',
            companyId: 'co1',
          }),
        }),
      );
    });

    it('returns graceful fallback when LLM throws', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: 'Conteúdo real da ligação',
        phoneNumber: '+55',
        duration: 60,
      });
      mockCache.getJson.mockResolvedValueOnce(null);
      mockCreate.mockRejectedValueOnce(new Error('rate limit'));

      const result = await service.summarizeCall('c1', 'co1', 'u1');

      expect(result.provider).toBe('fallback:error');
      expect(result.keyPoints.length).toBeGreaterThan(0);
      expect(result.sentimentTimeline.length).toBeGreaterThan(0);
      expect(result.nextBestAction).toMatch(/.+/);
    });

    it('parses non-JSON LLM output into minimal summary (no throw)', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: 'x',
        phoneNumber: '+55',
        duration: 1,
      });
      mockCache.getJson.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'isto não é JSON' } }],
      });

      const result = await service.summarizeCall('c1', 'co1', 'u1');

      expect(result.keyPoints.length).toBeGreaterThan(0);
      expect(result.sentimentTimeline.length).toBeGreaterThanOrEqual(2);
      expect(result.nextBestAction).toMatch(/.+/);
    });

    it('clamps keyPoints to 8 max', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: 'x',
        phoneNumber: '+55',
        duration: 1,
      });
      mockCache.getJson.mockResolvedValueOnce(null);
      const big = Array.from({ length: 20 }, (_, i) => `ponto ${i}`);
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPoints: big,
                sentimentTimeline: [{ position: 0.5, sentiment: 'neutral' }],
                nextBestAction: 'x',
              }),
            },
          },
        ],
      });

      const result = await service.summarizeCall('c1', 'co1', 'u1');
      expect(result.keyPoints.length).toBeLessThanOrEqual(8);
    });

    it('filters invalid sentiment ticks', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: 'x',
        phoneNumber: '+55',
        duration: 1,
      });
      mockCache.getJson.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPoints: ['k'],
                sentimentTimeline: [
                  { position: 0, sentiment: 'positive' },
                  { position: 'nope', sentiment: 'positive' },
                  { sentiment: 'happy' },
                  null,
                  { position: 0.9, sentiment: 'negative' },
                ],
                nextBestAction: 'x',
              }),
            },
          },
        ],
      });

      const result = await service.summarizeCall('c1', 'co1', 'u1');
      // Only 2 valid ticks should survive coercion.
      expect(result.sentimentTimeline).toHaveLength(2);
      expect(
        result.sentimentTimeline.every((t) =>
          ['positive', 'neutral', 'negative'].includes(t.sentiment),
        ),
      ).toBe(true);
    });
  });

  // =============================================
  // summarizeChat — chat source
  // =============================================
  describe('summarizeChat', () => {
    it('throws NotFoundException when chat missing', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce(null);
      await expect(service.summarizeChat('cx', 'co1', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when chat has zero messages', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: 'chat1',
        customerPhone: '+5511',
        customerName: 'Cliente X',
      });
      mockPrisma.whatsappMessage.findMany.mockResolvedValueOnce([]);
      await expect(service.summarizeChat('chat1', 'co1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('summarises chat with chronological transcript and tenant filter', async () => {
      mockPrisma.whatsappChat.findFirst.mockResolvedValueOnce({
        id: 'chat1',
        customerPhone: '+5511',
        customerName: 'Cliente X',
      });
      // Service fetches DESC, then reverses — provide DESC order here.
      mockPrisma.whatsappMessage.findMany.mockResolvedValueOnce([
        {
          direction: 'OUTGOING',
          content: 'segunda mensagem',
          createdAt: new Date('2026-04-10T10:01:00Z'),
        },
        {
          direction: 'INCOMING',
          content: 'primeira mensagem',
          createdAt: new Date('2026-04-10T10:00:00Z'),
        },
      ]);
      mockCache.getJson.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPoints: ['resumo 1'],
                sentimentTimeline: [{ position: 0.5, sentiment: 'neutral' }],
                nextBestAction: 'Seguir em frente',
              }),
            },
          },
        ],
      });

      const result = await service.summarizeChat('chat1', 'co1', 'u1');

      expect(mockPrisma.whatsappChat.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'chat1', companyId: 'co1' } }),
      );
      expect(result.provider).toBe('openai');
      expect(result.cached).toBe(false);

      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resource: 'WHATSAPP_CHAT',
            resourceId: 'chat1',
          }),
        }),
      );
    });
  });

  // =============================================
  // Session 45 — durable CallSummary + auto-trigger
  // =============================================
  describe('getPersistedCallSummary', () => {
    it('returns null when no persisted summary exists', async () => {
      mockPrisma.callSummary.findFirst.mockResolvedValueOnce(null);
      const result = await service.getPersistedCallSummary('c1', 'co1');
      expect(result).toBeNull();
    });

    it('enforces tenant isolation via companyId filter', async () => {
      mockPrisma.callSummary.findFirst.mockResolvedValueOnce(null);
      await service.getPersistedCallSummary('c1', 'co1');
      expect(mockPrisma.callSummary.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { callId: 'c1', companyId: 'co1' } }),
      );
    });

    it('rehydrates persisted row into ConversationSummary shape', async () => {
      const generatedAt = new Date('2026-04-18T12:00:00Z');
      mockPrisma.callSummary.findFirst.mockResolvedValueOnce({
        keyPoints: ['a', 'b'],
        sentimentTimeline: [{ position: 0.5, sentiment: 'positive' }],
        nextBestAction: 'Follow up',
        provider: 'openai',
        generatedAt,
      });
      const result = await service.getPersistedCallSummary('c1', 'co1');
      expect(result).not.toBeNull();
      expect(result!.cached).toBe(true);
      expect(result!.provider).toBe('openai');
      expect(result!.keyPoints).toEqual(['a', 'b']);
      expect(result!.sentimentTimeline).toHaveLength(1);
      expect(result!.generatedAt).toBe(generatedAt.toISOString());
    });

    it('coerces invalid JSON sentimentTimeline to neutral fallback', async () => {
      mockPrisma.callSummary.findFirst.mockResolvedValueOnce({
        keyPoints: ['k'],
        sentimentTimeline: 'not-an-array',
        nextBestAction: 'x',
        provider: 'openai',
        generatedAt: new Date(),
      });
      const result = await service.getPersistedCallSummary('c1', 'co1');
      expect(result!.sentimentTimeline).toEqual([{ position: 0, sentiment: 'neutral' }]);
    });
  });

  describe('autoSummarizeCall', () => {
    it('returns false when call not found (never throws)', async () => {
      mockPrisma.call.findUnique.mockResolvedValueOnce(null);
      const result = await service.autoSummarizeCall('missing');
      expect(result).toBe(false);
    });

    it('returns false when transcript is empty', async () => {
      mockPrisma.call.findUnique.mockResolvedValueOnce({
        id: 'c1',
        companyId: 'co1',
        userId: 'u1',
        transcript: '   ',
        phoneNumber: '+55',
        duration: 10,
      });
      const result = await service.autoSummarizeCall('c1');
      expect(result).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('is idempotent: skips when contentHash matches existing row', async () => {
      const transcript = 'Transcrição real da ligação.';
      mockPrisma.call.findUnique.mockResolvedValueOnce({
        id: 'c1',
        companyId: 'co1',
        userId: 'u1',
        transcript,
        phoneNumber: '+55',
        duration: 60,
      });
      // First findUnique call is in autoSummarizeCall itself (existing check).
      // Get the hash by running the service helper indirectly via a fresh LLM
      // call path first, but here we just reuse its own computed hash by
      // calling autoSummarizeCall twice. Simpler: emulate a prior row.
      // We don't know the exact hash at test time, so mock any string and let
      // the service compare; inject the same hash it will compute.
      // Trick: make findUnique return an object whose contentHash matches
      // whatever the service computes. We can't compute it without importing
      // crypto — so do it the easy way: pre-run by awaiting the call once
      // with no existing row, capturing the hash from upsert call args.
      // Setup: first invocation persists.
      mockPrisma.callSummary.findUnique.mockResolvedValueOnce(null); // idempotency check
      mockPrisma.callSummary.findUnique.mockResolvedValueOnce(null); // DB-hit check inside summarize
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPoints: ['p'],
                sentimentTimeline: [{ position: 0.5, sentiment: 'neutral' }],
                nextBestAction: 'x',
              }),
            },
          },
        ],
      });
      const first = await service.autoSummarizeCall('c1');
      expect(first).toBe(true);
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.callSummary.upsert).toHaveBeenCalled();
      const persistArgs = mockPrisma.callSummary.upsert.mock.calls[0][0];
      const contentHash = persistArgs.create.contentHash;
      expect(typeof contentHash).toBe('string');
      expect(contentHash).toHaveLength(16);

      // Second invocation: existing row with same hash → skip.
      mockPrisma.call.findUnique.mockResolvedValueOnce({
        id: 'c1',
        companyId: 'co1',
        userId: 'u1',
        transcript,
        phoneNumber: '+55',
        duration: 60,
      });
      mockPrisma.callSummary.findUnique.mockResolvedValueOnce({ contentHash });
      mockCreate.mockClear();

      const second = await service.autoSummarizeCall('c1');
      expect(second).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('persists CallSummary when transcript changes (hash mismatch)', async () => {
      mockPrisma.call.findUnique.mockResolvedValueOnce({
        id: 'c2',
        companyId: 'co1',
        userId: 'u1',
        transcript: 'Nova transcrição diferente',
        phoneNumber: '+55',
        duration: 60,
      });
      mockPrisma.callSummary.findUnique.mockResolvedValueOnce({ contentHash: 'stalehash0000000' });
      mockPrisma.callSummary.findUnique.mockResolvedValueOnce(null);
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPoints: ['novo'],
                sentimentTimeline: [{ position: 0.5, sentiment: 'positive' }],
                nextBestAction: 'Avançar',
              }),
            },
          },
        ],
      });
      const result = await service.autoSummarizeCall('c2');
      expect(result).toBe(true);
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.callSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { callId: 'c2' },
          create: expect.objectContaining({
            callId: 'c2',
            companyId: 'co1',
            nextBestAction: 'Avançar',
          }),
        }),
      );
    });

    it('swallows unexpected errors (never throws from hot path)', async () => {
      mockPrisma.call.findUnique.mockRejectedValueOnce(new Error('db down'));
      const result = await service.autoSummarizeCall('c1');
      expect(result).toBe(false);
    });
  });

  describe('summarize (call) — durable DB miss still falls through to LLM', () => {
    it('falls through to LLM + upserts CallSummary when no persisted row exists', async () => {
      mockPrisma.call.findFirst.mockResolvedValueOnce({
        id: 'c1',
        transcript: 'Consistent transcript',
        phoneNumber: '+55',
        duration: 1,
      });
      mockPrisma.callSummary.findUnique.mockResolvedValue(null); // DB miss
      mockCache.getJson.mockResolvedValueOnce(null); // cache miss
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyPoints: ['k'],
                sentimentTimeline: [{ position: 0.5, sentiment: 'neutral' }],
                nextBestAction: 'x',
              }),
            },
          },
        ],
      });

      const result = await service.summarizeCall('c1', 'co1', 'u1');
      expect(result.provider).toBe('openai');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      // Persistence is fire-and-forget; flush.
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.callSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { callId: 'c1' } }),
      );
    });
  });
});
