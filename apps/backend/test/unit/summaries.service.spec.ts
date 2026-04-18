// =============================================
// 🧠 SummariesService — unit tests (Session 44)
// =============================================

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    call: { findFirst: jest.fn() },
    whatsappChat: { findFirst: jest.fn() },
    whatsappMessage: { findMany: jest.fn() },
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummariesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => mockConfigValues[k]) },
        },
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
});
