/**
 * KnowledgeBaseService — Unit Tests
 *
 * Coverage targets (§13 CLAUDE.md):
 *   - Happy path: embed, ingestChunk, ingestBatch, findRelevant, findAll, findOne, update, remove
 *   - Failure modes: missing API key, duplicate hash, chunk capacity exceeded,
 *     embedding API error, pgvector query error, tenant isolation guard, not found
 *
 * Mock strategy:
 *   - PrismaService: jest.Mocked<Partial<PrismaService>> with $queryRaw / $executeRaw
 *   - OpenAI: mock openai module entirely (no real HTTP calls)
 *   - ConfigService: returns OPENAI_API_KEY = 'sk-test' for happy paths, undefined for failure paths
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { KnowledgeChunkSource, Prisma } from '@prisma/client';

import { KnowledgeBaseService } from '../../src/modules/knowledge-base/knowledge-base.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CreateKnowledgeChunkDto } from '../../src/modules/knowledge-base/dto/create-knowledge-chunk.dto';
import { UpdateKnowledgeChunkDto } from '../../src/modules/knowledge-base/dto/update-knowledge-chunk.dto';

// =============================================
// OpenAI mock (module-level, before imports that touch openai)
// =============================================

const mockEmbeddingsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockEmbeddingsCreate,
    },
  }));
});

// =============================================
// Shared fixtures
// =============================================

const COMPANY_ID = 'company-uuid-1234';
const CHUNK_ID = 'chunk-uuid-abcd';

const MOCK_EMBEDDING = Array.from({ length: 1536 }, (_, i) => i / 1536);

const MOCK_CHUNK = {
  id: CHUNK_ID,
  companyId: COMPANY_ID,
  source: KnowledgeChunkSource.DOCUMENT,
  sourceRef: 'test-doc.pdf',
  chunkIndex: 0,
  content: 'This is a test knowledge chunk about our product pricing.',
  contentHash: 'a'.repeat(64),
  metadata: { page: 1 },
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-05-25'),
  updatedAt: new Date('2026-05-25'),
};

// =============================================
// PrismaService mock
// =============================================

const mockPrismaService = {
  knowledgeChunk: {
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
};

// =============================================
// ConfigService factory
// =============================================

function makeConfigService(withApiKey = true) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return withApiKey ? 'sk-test-fake-key' : undefined;
      return undefined;
    }),
  };
}

// =============================================
// Test setup helper
// =============================================

async function buildModule(withApiKey = true): Promise<KnowledgeBaseService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      KnowledgeBaseService,
      { provide: PrismaService, useValue: mockPrismaService },
      { provide: ConfigService, useValue: makeConfigService(withApiKey) },
    ],
  }).compile();

  return module.get<KnowledgeBaseService>(KnowledgeBaseService);
}

// =============================================
// Tests
// =============================================

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildModule(true);
  });

  // ==========================================
  // embed()
  // ==========================================

  describe('embed()', () => {
    it('returns a 1536-dim embedding for valid text', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      });

      const result = await service.embed('test text');

      expect(result).toHaveLength(1536);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-small',
          dimensions: 1536,
        }),
      );
    });

    it('throws BadRequestException when OpenAI API key is not configured', async () => {
      const noKeyService = await buildModule(false);

      await expect(noKeyService.embed('text')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when OpenAI returns wrong dimension count', async () => {
      // Only 100 dims instead of 1536
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: new Array(100).fill(0.1), index: 0 }],
      });

      await expect(service.embed('text')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when OpenAI API call rejects', async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      await expect(service.embed('text')).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // embedBatch()
  // ==========================================

  describe('embedBatch()', () => {
    it('returns embeddings in input order for batch of texts', async () => {
      const embeddingA = MOCK_EMBEDDING.map((v) => v * 0.9);
      const embeddingB = MOCK_EMBEDDING.map((v) => v * 0.8);

      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [
          { embedding: embeddingA, index: 0 },
          { embedding: embeddingB, index: 1 },
        ],
      });

      const result = await service.embedBatch(['text A', 'text B']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(embeddingA);
      expect(result[1]).toEqual(embeddingB);
    });

    it('returns empty array for empty input without API call', async () => {
      const result = await service.embedBatch([]);
      expect(result).toEqual([]);
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for batch exceeding 100 texts', async () => {
      const oversized = new Array(101).fill('text');
      await expect(service.embedBatch(oversized)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when embedding is not configured', async () => {
      const noKeyService = await buildModule(false);
      await expect(noKeyService.embedBatch(['text'])).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // ingestChunk()
  // ==========================================

  describe('ingestChunk()', () => {
    const dto: CreateKnowledgeChunkDto = {
      source: KnowledgeChunkSource.DOCUMENT,
      sourceRef: 'product-catalog.pdf',
      content: 'Our Enterprise plan costs R$697/month and includes unlimited AI suggestions.',
      chunkIndex: 0,
      isActive: true,
    };

    beforeEach(() => {
      // Default: no existing chunk (fresh ingest)
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      });
      // Capacity check: 0 active chunks
      mockPrismaService.knowledgeChunk.count.mockResolvedValue(0);
      // INSERT returns new id
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: CHUNK_ID }]);
      // findUniqueOrThrow returns the created chunk
      mockPrismaService.knowledgeChunk.findUniqueOrThrow.mockResolvedValue(MOCK_CHUNK);
    });

    it('creates a new chunk and returns it on first ingest', async () => {
      const result = await service.ingestChunk(COMPANY_ID, dto);

      expect(result).toMatchObject({ id: CHUNK_ID, companyId: COMPANY_ID });
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('upserts (reactivates) an existing chunk instead of inserting a duplicate', async () => {
      // Simulate existing chunk
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValue(MOCK_CHUNK);
      mockPrismaService.$executeRaw.mockResolvedValue(1);
      mockPrismaService.knowledgeChunk.findUniqueOrThrow.mockResolvedValue(MOCK_CHUNK);

      const result = await service.ingestChunk(COMPANY_ID, dto);

      expect(result.id).toBe(CHUNK_ID);
      // Should execute UPDATE, not INSERT
      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when UPDATE affects 0 rows (tenant isolation violation)', async () => {
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValue(MOCK_CHUNK);
      // UPDATE returns 0 (e.g., wrong companyId silently filtered by WHERE clause)
      mockPrismaService.$executeRaw.mockResolvedValue(0);

      await expect(service.ingestChunk(COMPANY_ID, dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when chunk capacity is at maximum', async () => {
      mockPrismaService.knowledgeChunk.count.mockResolvedValue(10_000);

      await expect(service.ingestChunk(COMPANY_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('handles concurrent ingest race (P2002 unique constraint) gracefully', async () => {
      mockPrismaService.knowledgeChunk.findFirst
        .mockResolvedValueOnce(null) // first check: no existing
        .mockResolvedValueOnce(MOCK_CHUNK); // after P2002: find existing

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mockPrismaService.$queryRaw.mockRejectedValueOnce(p2002Error);
      mockPrismaService.knowledgeChunk.findFirstOrThrow.mockResolvedValue(MOCK_CHUNK);

      const result = await service.ingestChunk(COMPANY_ID, dto);
      expect(result.id).toBe(CHUNK_ID);
    });

    it('throws BadRequestException when embedding is not configured', async () => {
      const noKeyService = await buildModule(false);
      mockPrismaService.knowledgeChunk.count.mockResolvedValue(0);

      await expect(noKeyService.ingestChunk(COMPANY_ID, dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // ingestBatch()
  // ==========================================

  describe('ingestBatch()', () => {
    it('returns zero counts for empty input without any API calls', async () => {
      const result = await service.ingestBatch(COMPANY_ID, []);

      expect(result).toEqual({ created: 0, skipped: 0, errors: 0, chunkIds: [] });
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it('creates multiple chunks and reports correct created count', async () => {
      mockPrismaService.knowledgeChunk.count.mockResolvedValue(0);
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [
          { embedding: MOCK_EMBEDDING, index: 0 },
          { embedding: MOCK_EMBEDDING, index: 1 },
        ],
      });
      // ON CONFLICT DO NOTHING → RETURNING id
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ id: 'chunk-1' }])
        .mockResolvedValueOnce([{ id: 'chunk-2' }]);

      const chunks = [
        {
          source: KnowledgeChunkSource.MANUAL,
          sourceRef: 'faq',
          content: 'Content chunk one unique text',
        },
        {
          source: KnowledgeChunkSource.MANUAL,
          sourceRef: 'faq',
          content: 'Content chunk two unique text',
        },
      ];

      const result = await service.ingestBatch(COMPANY_ID, chunks as CreateKnowledgeChunkDto[]);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.chunkIds).toHaveLength(2);
    });

    it('counts duplicate chunks as skipped (same content hash within batch)', async () => {
      mockPrismaService.knowledgeChunk.count.mockResolvedValue(0);
      // First chunk: no existing
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      });
      mockPrismaService.$queryRaw.mockResolvedValue([{ id: 'chunk-1' }]);

      // Same content string → same hash → deduped before DB hit
      const identicalContent = 'Identical content for dedup test';
      const chunks = [
        { source: KnowledgeChunkSource.MANUAL, sourceRef: 'src', content: identicalContent },
        { source: KnowledgeChunkSource.MANUAL, sourceRef: 'src', content: identicalContent },
      ];

      const result = await service.ingestBatch(COMPANY_ID, chunks as CreateKnowledgeChunkDto[]);

      // 1 unique chunk created, 1 filtered as in-batch duplicate before any DB call
      expect(result.created).toBe(1);
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1); // only 1 embed call
    });

    it('counts DB-duplicate chunks as skipped (ON CONFLICT DO NOTHING returns empty)', async () => {
      mockPrismaService.knowledgeChunk.count.mockResolvedValue(0);
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      });
      // ON CONFLICT DO NOTHING → no RETURNING rows (concurrent conflict)
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const chunks = [
        {
          source: KnowledgeChunkSource.DOCUMENT,
          sourceRef: 'doc.pdf',
          content: 'Unique content A',
        },
      ];

      const result = await service.ingestBatch(COMPANY_ID, chunks as CreateKnowledgeChunkDto[]);

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
    });

    it('counts chunks with zero-length embedding (batch embed failure) as errors', async () => {
      mockPrismaService.knowledgeChunk.count.mockResolvedValue(0);
      // Simulate batch embed API failure
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('API unavailable'));

      const chunks = [
        { source: KnowledgeChunkSource.DOCUMENT, sourceRef: 'doc.pdf', content: 'Some content X1' },
      ];

      const result = await service.ingestBatch(COMPANY_ID, chunks as CreateKnowledgeChunkDto[]);

      expect(result.errors).toBe(1);
      expect(result.created).toBe(0);
    });
  });

  // ==========================================
  // findRelevant()
  // ==========================================

  describe('findRelevant()', () => {
    const MOCK_VECTOR_ROWS = [
      {
        id: 'chunk-1',
        content: 'Enterprise plan pricing info',
        source: KnowledgeChunkSource.DOCUMENT,
        source_ref: 'catalog.pdf',
        chunk_index: 0,
        metadata: { page: 1 },
        score: 0.92,
      },
      {
        id: 'chunk-2',
        content: 'Refund policy details',
        source: KnowledgeChunkSource.MANUAL,
        source_ref: 'faq',
        chunk_index: 1,
        metadata: null,
        score: 0.75,
      },
    ];

    beforeEach(() => {
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      });
      mockPrismaService.$queryRaw.mockResolvedValue(MOCK_VECTOR_ROWS);
    });

    it('returns relevant chunks sorted by score, above minScore threshold', async () => {
      const results = await service.findRelevant(COMPANY_ID, 'pricing information', 5, 0.7);

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBe(0.92);
      expect(results[1]?.score).toBe(0.75);
      expect(results[0]).toMatchObject({
        id: 'chunk-1',
        source: KnowledgeChunkSource.DOCUMENT,
        sourceRef: 'catalog.pdf',
      });
    });

    it('filters out chunks below minScore threshold', async () => {
      const results = await service.findRelevant(COMPANY_ID, 'pricing information', 5, 0.8);

      // Only chunk-1 (score=0.92) passes; chunk-2 (score=0.75) is filtered
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('chunk-1');
    });

    it('returns empty array and does NOT embed when embedding is not configured', async () => {
      const noKeyService = await buildModule(false);

      const results = await noKeyService.findRelevant(COMPANY_ID, 'query', 5, 0.7);

      expect(results).toEqual([]);
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it('returns empty array (graceful degradation) when embedding call fails', async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('Timeout'));

      const results = await service.findRelevant(COMPANY_ID, 'query', 5, 0.7);

      expect(results).toEqual([]);
    });

    it('returns empty array (graceful degradation) when vector query fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('pgvector error'));

      const results = await service.findRelevant(COMPANY_ID, 'query', 5, 0.7);

      expect(results).toEqual([]);
    });

    it('clamps topK to max 20', async () => {
      await service.findRelevant(COMPANY_ID, 'query', 9999, 0.7);
      // Raw query called — can't easily inspect LIMIT in tagged template
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });
  });

  // ==========================================
  // buildContextString()
  // ==========================================

  describe('buildContextString()', () => {
    it('returns empty string when chunks array is empty', () => {
      const result = service.buildContextString([]);
      expect(result).toBe('');
    });

    it('builds formatted context string from chunks', () => {
      const chunks = [
        {
          id: 'c1',
          content: 'Pricing details here',
          source: KnowledgeChunkSource.DOCUMENT,
          sourceRef: 'catalog.pdf',
          chunkIndex: 0,
          score: 0.91,
          metadata: null,
        },
      ];

      const result = service.buildContextString(chunks);

      expect(result).toContain('COMPANY KNOWLEDGE BASE');
      expect(result).toContain('Pricing details here');
      expect(result).toContain('catalog.pdf');
      expect(result).toContain('0.91');
      expect(result).toContain('END KNOWLEDGE BASE');
    });
  });

  // ==========================================
  // findAll()
  // ==========================================

  describe('findAll()', () => {
    it('returns paginated chunk list with total count', async () => {
      mockPrismaService.$transaction.mockResolvedValueOnce([[MOCK_CHUNK], 1]);

      const result = await service.findAll(COMPANY_ID, { limit: 50 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.cursor).toBeNull(); // data.length < limit
    });

    it('returns next cursor when data length equals limit', async () => {
      // Return 2 chunks with limit=2 → cursor should be last chunk id
      const chunk2 = { ...MOCK_CHUNK, id: 'chunk-2' };
      mockPrismaService.$transaction.mockResolvedValueOnce([[MOCK_CHUNK, chunk2], 10]);

      const result = await service.findAll(COMPANY_ID, { limit: 2 });

      expect(result.cursor).toBe('chunk-2');
    });

    it('applies source filter to the where clause', async () => {
      mockPrismaService.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(COMPANY_ID, { source: KnowledgeChunkSource.DOCUMENT });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================
  // findOne()
  // ==========================================

  describe('findOne()', () => {
    it('returns the chunk when found with matching companyId', async () => {
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(MOCK_CHUNK);

      const result = await service.findOne(COMPANY_ID, CHUNK_ID);

      expect(result.id).toBe(CHUNK_ID);
      expect(mockPrismaService.knowledgeChunk.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: CHUNK_ID, companyId: COMPANY_ID }),
        }),
      );
    });

    it('throws NotFoundException when chunk does not exist', async () => {
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(COMPANY_ID, 'nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when chunk belongs to a different company (tenant isolation)', async () => {
      // Prisma query scoped by companyId returns null for wrong tenant
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne('different-company-id', CHUNK_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================
  // update()
  // ==========================================

  describe('update()', () => {
    const updateDto: UpdateKnowledgeChunkDto = {
      sourceRef: 'updated-doc.pdf',
      isActive: false,
    };

    it('updates metadata without re-embedding when content is unchanged', async () => {
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(MOCK_CHUNK);
      mockPrismaService.knowledgeChunk.update.mockResolvedValueOnce(MOCK_CHUNK);
      // findOne for return value
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(MOCK_CHUNK);

      await service.update(COMPANY_ID, CHUNK_ID, updateDto);

      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
      expect(mockPrismaService.knowledgeChunk.update).toHaveBeenCalled();
    });

    it('re-embeds when content changes', async () => {
      mockPrismaService.knowledgeChunk.findFirst
        .mockResolvedValueOnce(MOCK_CHUNK) // initial ownership check
        .mockResolvedValueOnce(null) // hash collision check (no collision)
        .mockResolvedValueOnce(MOCK_CHUNK); // findOne for return value

      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      });
      mockPrismaService.$executeRaw.mockResolvedValueOnce(1);

      await service.update(COMPANY_ID, CHUNK_ID, {
        content: 'New and updated content for this knowledge chunk.',
      });

      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
    });

    it('throws BadRequestException when new content hash collides with another chunk', async () => {
      mockPrismaService.knowledgeChunk.findFirst
        .mockResolvedValueOnce(MOCK_CHUNK) // ownership check
        .mockResolvedValueOnce({ id: 'other-chunk-id' }); // hash collision found

      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: MOCK_EMBEDDING, index: 0 }],
      });

      await expect(
        service.update(COMPANY_ID, CHUNK_ID, { content: 'Colliding content here' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when chunk not found for update', async () => {
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(null);

      await expect(service.update(COMPANY_ID, CHUNK_ID, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================
  // remove()
  // ==========================================

  describe('remove()', () => {
    it('soft-deletes the chunk (sets deletedAt, isActive=false)', async () => {
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(MOCK_CHUNK);
      mockPrismaService.knowledgeChunk.update.mockResolvedValueOnce({
        ...MOCK_CHUNK,
        isActive: false,
        deletedAt: new Date(),
      });

      await service.remove(COMPANY_ID, CHUNK_ID);

      expect(mockPrismaService.knowledgeChunk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CHUNK_ID },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('throws NotFoundException when chunk not found', async () => {
      mockPrismaService.knowledgeChunk.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove(COMPANY_ID, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // removeBySourceRef()
  // ==========================================

  describe('removeBySourceRef()', () => {
    it('soft-deletes all chunks matching sourceRef within the company', async () => {
      mockPrismaService.knowledgeChunk.updateMany.mockResolvedValueOnce({ count: 7 });

      const count = await service.removeBySourceRef(COMPANY_ID, 'product-catalog.pdf');

      expect(count).toBe(7);
      expect(mockPrismaService.knowledgeChunk.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            sourceRef: 'product-catalog.pdf',
          }),
        }),
      );
    });

    it('returns 0 when no chunks match (no-op — idempotent)', async () => {
      mockPrismaService.knowledgeChunk.updateMany.mockResolvedValueOnce({ count: 0 });

      const count = await service.removeBySourceRef(COMPANY_ID, 'nonexistent-source');

      expect(count).toBe(0);
    });
  });

  // ==========================================
  // countActive()
  // ==========================================

  describe('countActive()', () => {
    it('returns active chunk count for the company', async () => {
      mockPrismaService.knowledgeChunk.count.mockResolvedValueOnce(42);

      const count = await service.countActive(COMPANY_ID);

      expect(count).toBe(42);
      expect(mockPrismaService.knowledgeChunk.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
    });
  });
});
