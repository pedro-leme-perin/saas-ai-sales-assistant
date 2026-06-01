import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, KnowledgeChunk, KnowledgeChunkSource } from '@prisma/client';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateKnowledgeChunkDto } from './dto/create-knowledge-chunk.dto';
import { UpdateKnowledgeChunkDto } from './dto/update-knowledge-chunk.dto';
import { QueryKnowledgeBaseDto } from './dto/query-knowledge-base.dto';

// =============================================
// Constants
// =============================================

/** OpenAI embedding model — 1536 dimensions, $0.02/1M tokens */
const EMBEDDING_MODEL = 'text-embedding-3-small' as const;

/** Dimensions must match the vector(1536) column in migration */
const EMBEDDING_DIMS = 1536 as const;

/** Maximum characters per chunk. ~400 tokens at avg 4 chars/token. */
const MAX_CHUNK_CHARS = 1600 as const;

/** Cap on active chunks per company (cost + performance guard) */
const MAX_CHUNKS_PER_COMPANY = 10_000 as const;

/** Default top-k for RAG retrieval */
const DEFAULT_TOP_K = 5 as const;

/** Default minimum cosine similarity (0 = opposite, 1 = identical) */
const DEFAULT_MIN_SCORE = 0.7 as const;

// =============================================
// Types
// =============================================

export interface RelevantChunk {
  id: string;
  content: string;
  source: KnowledgeChunkSource;
  sourceRef: string;
  chunkIndex: number;
  score: number; // cosine similarity [0,1]
  metadata: Prisma.JsonValue;
}

export interface IngestResult {
  created: number;
  skipped: number; // duplicate contentHash
  errors: number;
  chunkIds: string[];
}

// Raw query result row from pgvector search
interface VectorSearchRow {
  id: string;
  content: string;
  source: KnowledgeChunkSource;
  source_ref: string;
  chunk_index: number;
  metadata: Prisma.JsonValue;
  score: number;
}

// =============================================
// Service
// =============================================

/**
 * KnowledgeBaseService — RAG retrieval and chunk management.
 *
 * Architecture:
 *   - Embeddings: OpenAI text-embedding-3-small (1536 dims) via existing SDK
 *   - Storage: pgvector column in knowledge_chunks (Unsupported Prisma type → raw SQL)
 *   - Retrieval: cosine distance <=> operator, prisma.$queryRaw
 *   - Multi-tenancy: companyId on every query (DDIA Cap. 2)
 *   - Idempotency: SHA-256 contentHash upsert guard (prevents duplicate embedding costs)
 *
 * References:
 *   - DDIA Cap. 3: index structures — IVFFlat for ANN
 *   - Designing ML Systems: embedding-based retrieval pattern
 *   - Clean Architecture Cap. 22: service does not import HTTP layer
 */
@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private readonly openai: OpenAI;
  private readonly isEmbeddingConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.isEmbeddingConfigured = !!apiKey;

    if (!apiKey) {
      this.logger.warn(
        '⚠️ OPENAI_API_KEY not set — KnowledgeBaseService running in degraded mode (no embeddings)',
      );
      // Still allow chunk CRUD; embedding calls will throw with clear message
      this.openai = null as unknown as OpenAI;
    } else {
      this.openai = new OpenAI({ apiKey });
      this.logger.log(
        `✅ KnowledgeBaseService initialized (model: ${EMBEDDING_MODEL}, dims: ${EMBEDDING_DIMS})`,
      );
    }
  }

  // ==========================================
  // EMBEDDING
  // ==========================================

  /**
   * Embed a single text string.
   * Throws if OpenAI key not configured.
   * Latency: ~200-500ms for typical chunk sizes.
   */
  async embed(text: string): Promise<number[]> {
    this.assertEmbeddingConfigured();

    // Truncate oversized input to avoid API rejection (8191 token limit)
    const truncated = text.slice(0, MAX_CHUNK_CHARS * 4); // conservative byte cap

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncated,
        dimensions: EMBEDDING_DIMS,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || embedding.length !== EMBEDDING_DIMS) {
        throw new Error(
          `Unexpected embedding dimensions: expected ${EMBEDDING_DIMS}, got ${embedding?.length ?? 0}`,
        );
      }

      return embedding;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Embedding failed: ${msg}`);
      throw new BadRequestException(`Embedding generation failed: ${msg}`);
    }
  }

  /**
   * Embed a batch of texts (up to 100 per API call — OpenAI limit).
   * Returns embeddings in the same order as the input array.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    this.assertEmbeddingConfigured();

    if (texts.length === 0) return [];
    if (texts.length > 100) {
      throw new BadRequestException('Batch size exceeds maximum of 100 texts per call');
    }

    const truncated = texts.map((t) => t.slice(0, MAX_CHUNK_CHARS * 4));

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncated,
        dimensions: EMBEDDING_DIMS,
      });

      // Sort by index to guarantee order (OpenAI returns in order but be explicit)
      return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Batch embedding failed: ${msg}`);
      throw new BadRequestException(`Batch embedding generation failed: ${msg}`);
    }
  }

  // ==========================================
  // INGEST
  // ==========================================

  /**
   * Ingest a single chunk: embed → upsert (idempotent by contentHash).
   * Multi-tenancy: companyId enforced as first-class param.
   */
  async ingestChunk(companyId: string, dto: CreateKnowledgeChunkDto): Promise<KnowledgeChunk> {
    await this.assertChunkCapacity(companyId);

    const contentHash = this.hashContent(dto.content);
    const embedding = await this.embed(dto.content);
    const embeddingLiteral = this.toVectorLiteral(embedding);

    // Upsert: if contentHash already exists for this company, update metadata + reactivate
    try {
      const existing = await this.prisma.knowledgeChunk.findFirst({
        where: { companyId, contentHash },
      });

      if (existing) {
        // Re-activate if soft-deleted; update sourceRef/metadata if caller provides updates
        const updated = await this.prisma.$executeRaw`
          UPDATE knowledge_chunks
          SET
            source_ref   = ${dto.sourceRef},
            chunk_index  = ${dto.chunkIndex ?? 0},
            metadata     = ${dto.metadata ? JSON.stringify(dto.metadata) : existing.metadata}::jsonb,
            is_active    = true,
            deleted_at   = NULL,
            embedding    = ${embeddingLiteral}::vector,
            updated_at   = NOW()
          WHERE id = ${existing.id} AND company_id = ${companyId}
        `;

        if (updated === 0) {
          throw new ForbiddenException('Chunk update rejected — tenant isolation violation');
        }

        return (await this.prisma.knowledgeChunk.findUniqueOrThrow({
          where: { id: existing.id },
        })) as KnowledgeChunk;
      }

      // Insert new chunk with embedding
      const id = await this.prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO knowledge_chunks
          (id, company_id, source, source_ref, chunk_index, content, content_hash, embedding, metadata, is_active, created_at, updated_at)
        VALUES
          (gen_random_uuid()::text, ${companyId}, ${dto.source}::"KnowledgeChunkSource", ${dto.sourceRef},
           ${dto.chunkIndex ?? 0}, ${dto.content}, ${contentHash},
           ${embeddingLiteral}::vector,
           ${dto.metadata ? JSON.stringify(dto.metadata) : null}::jsonb,
           ${dto.isActive ?? true}, NOW(), NOW())
        RETURNING id
      `;

      const chunkId = id[0]?.id;
      if (!chunkId) throw new Error('Insert did not return id');

      return (await this.prisma.knowledgeChunk.findUniqueOrThrow({
        where: { id: chunkId },
      })) as KnowledgeChunk;
    } catch (error: unknown) {
      // Unique constraint race condition (concurrent ingestion of same content)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(
          `Duplicate chunk (concurrent ingest) — contentHash=${contentHash} companyId=${companyId}`,
        );
        return (await this.prisma.knowledgeChunk.findFirstOrThrow({
          where: { companyId, contentHash },
        })) as KnowledgeChunk;
      }
      throw error;
    }
  }

  /**
   * Ingest multiple chunks in a single operation.
   * Embeds in batch (100 per OpenAI call), then upserts sequentially.
   * Returns counts: created / skipped (duplicate) / errors.
   *
   * Note: intentionally sequential upserts (not Promise.all) to avoid
   * overwhelming the DB connection pool on large ingestion batches.
   */
  async ingestBatch(companyId: string, chunks: CreateKnowledgeChunkDto[]): Promise<IngestResult> {
    if (chunks.length === 0) return { created: 0, skipped: 0, errors: 0, chunkIds: [] };

    await this.assertChunkCapacity(companyId);

    const result: IngestResult = { created: 0, skipped: 0, errors: 0, chunkIds: [] };

    // Dedupe within batch by contentHash before hitting DB
    const seen = new Set<string>();
    const deduped = chunks.filter((c) => {
      const hash = this.hashContent(c.content);
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });

    // Embed in batches of 100 (OpenAI limit)
    const BATCH_SIZE = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const slice = deduped.slice(i, i + BATCH_SIZE);
      try {
        const batch = await this.embedBatch(slice.map((c) => c.content));
        embeddings.push(...batch);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Batch embedding failed at offset ${i}: ${msg}`);
        // Fill placeholders so index alignment stays correct.
        // Errors counted in upsert loop via empty-embedding check (avoids double-counting).
        embeddings.push(...slice.map(() => [] as number[]));
      }
    }

    // Upsert each chunk
    for (let i = 0; i < deduped.length; i++) {
      const chunk = deduped[i];
      const embedding = embeddings[i];

      if (!embedding || embedding.length === 0) {
        result.errors++;
        continue;
      }

      const contentHash = this.hashContent(chunk.content);

      try {
        const existing = await this.prisma.knowledgeChunk.findFirst({
          where: { companyId, contentHash },
          select: { id: true },
        });

        if (existing) {
          result.skipped++;
          result.chunkIds.push(existing.id);
          continue;
        }

        const embeddingLiteral = this.toVectorLiteral(embedding);

        const inserted = await this.prisma.$queryRaw<{ id: string }[]>`
          INSERT INTO knowledge_chunks
            (id, company_id, source, source_ref, chunk_index, content, content_hash, embedding, metadata, is_active, created_at, updated_at)
          VALUES
            (gen_random_uuid()::text, ${companyId}, ${chunk.source}::"KnowledgeChunkSource", ${chunk.sourceRef},
             ${chunk.chunkIndex ?? i}, ${chunk.content}, ${contentHash},
             ${embeddingLiteral}::vector,
             ${chunk.metadata ? JSON.stringify(chunk.metadata) : null}::jsonb,
             ${chunk.isActive ?? true}, NOW(), NOW())
          ON CONFLICT (company_id, content_hash) DO NOTHING
          RETURNING id
        `;

        if (inserted.length > 0 && inserted[0]?.id) {
          result.created++;
          result.chunkIds.push(inserted[0].id);
        } else {
          // ON CONFLICT DO NOTHING — concurrent duplicate
          result.skipped++;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Chunk upsert error (sourceRef=${chunk.sourceRef} idx=${i}): ${msg}`);
        result.errors++;
      }
    }

    this.logger.log(
      `Ingest batch complete — companyId=${companyId} created=${result.created} skipped=${result.skipped} errors=${result.errors}`,
    );

    return result;
  }

  // ==========================================
  // RETRIEVAL (RAG)
  // ==========================================

  /**
   * Find the top-k most semantically relevant chunks for a query.
   * Used by AIManagerService to build RAG context before LLM calls.
   *
   * Cosine distance via pgvector <=> operator.
   * Returns chunks sorted by similarity descending (most relevant first).
   *
   * Multi-tenancy: companyId is the first filter in the WHERE clause —
   * the IVFFlat index scan is scoped per-company by the planner.
   */
  async findRelevant(
    companyId: string,
    query: string,
    topK: number = DEFAULT_TOP_K,
    minScore: number = DEFAULT_MIN_SCORE,
    source?: KnowledgeChunkSource,
  ): Promise<RelevantChunk[]> {
    if (!this.isEmbeddingConfigured) {
      this.logger.warn('findRelevant called but embedding not configured — returning empty');
      return [];
    }

    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embed(query);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`findRelevant embed failed: ${msg}`);
      return []; // graceful degradation — caller gets no context but LLM still runs
    }

    const embeddingLiteral = this.toVectorLiteral(queryEmbedding);
    const clampedTopK = Math.min(Math.max(1, topK), 20);
    const clampedMinScore = Math.min(Math.max(0, minScore), 1);

    try {
      let rows: VectorSearchRow[];

      if (source) {
        // Source-filtered search
        rows = await this.prisma.$queryRaw<VectorSearchRow[]>`
          SELECT
            id,
            content,
            source,
            source_ref,
            chunk_index,
            metadata,
            1 - (embedding <=> ${embeddingLiteral}::vector) AS score
          FROM knowledge_chunks
          WHERE
            company_id = ${companyId}
            AND is_active = true
            AND deleted_at IS NULL
            AND source = ${source}::"KnowledgeChunkSource"
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${embeddingLiteral}::vector
          LIMIT ${clampedTopK}
        `;
      } else {
        rows = await this.prisma.$queryRaw<VectorSearchRow[]>`
          SELECT
            id,
            content,
            source,
            source_ref,
            chunk_index,
            metadata,
            1 - (embedding <=> ${embeddingLiteral}::vector) AS score
          FROM knowledge_chunks
          WHERE
            company_id = ${companyId}
            AND is_active = true
            AND deleted_at IS NULL
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${embeddingLiteral}::vector
          LIMIT ${clampedTopK}
        `;
      }

      // Filter by minimum similarity threshold and map to output type
      return rows
        .filter((row) => Number(row.score) >= clampedMinScore)
        .map((row) => ({
          id: row.id,
          content: row.content,
          source: row.source,
          sourceRef: row.source_ref,
          chunkIndex: row.chunk_index,
          score: Number(row.score),
          metadata: row.metadata,
        }));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`findRelevant query failed: ${msg}`);
      return []; // graceful degradation
    }
  }

  /**
   * Build a RAG context string from relevant chunks.
   * Formats chunks for injection into the LLM system prompt.
   * Called by AIManagerService before generateSuggestion.
   */
  buildContextString(chunks: RelevantChunk[]): string {
    if (chunks.length === 0) return '';

    const lines = ['--- COMPANY KNOWLEDGE BASE (use this context to improve your suggestions) ---'];

    for (const chunk of chunks) {
      lines.push(`[${chunk.source} | ${chunk.sourceRef} | score=${chunk.score.toFixed(2)}]`);
      lines.push(chunk.content.trim());
      lines.push('');
    }

    lines.push('--- END KNOWLEDGE BASE ---');
    return lines.join('\n');
  }

  // ==========================================
  // CRUD
  // ==========================================

  async findAll(
    companyId: string,
    query: QueryKnowledgeBaseDto,
  ): Promise<{ data: KnowledgeChunk[]; total: number; cursor: string | null }> {
    const { source, sourceRef, isActive = true, limit = 50, cursor } = query;

    const where: Prisma.KnowledgeChunkWhereInput = {
      companyId,
      isActive,
      deletedAt: null,
      ...(source && { source }),
      ...(sourceRef && { sourceRef }),
      ...(cursor && { id: { gt: cursor } }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.knowledgeChunk.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        // Exclude embedding column — it's a large float array and not useful in API responses
        select: {
          id: true,
          companyId: true,
          source: true,
          sourceRef: true,
          chunkIndex: true,
          content: true,
          contentHash: true,
          metadata: true,
          isActive: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.knowledgeChunk.count({ where }),
    ]);

    const nextCursor = data.length === limit ? (data[data.length - 1]?.id ?? null) : null;

    return {
      data: data as unknown as KnowledgeChunk[],
      total,
      cursor: nextCursor,
    };
  }

  async findOne(companyId: string, id: string): Promise<KnowledgeChunk> {
    const chunk = await this.prisma.knowledgeChunk.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        source: true,
        sourceRef: true,
        chunkIndex: true,
        content: true,
        contentHash: true,
        metadata: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!chunk) {
      throw new NotFoundException(`KnowledgeChunk ${id} not found`);
    }

    return chunk as unknown as KnowledgeChunk;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateKnowledgeChunkDto,
  ): Promise<KnowledgeChunk> {
    // Verify ownership before any mutation
    const existing = await this.prisma.knowledgeChunk.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`KnowledgeChunk ${id} not found`);
    }

    // If content changed → re-embed and update contentHash
    if (dto.content && dto.content !== existing.content) {
      const newHash = this.hashContent(dto.content);

      // Check for hash collision with another chunk in this company
      const collision = await this.prisma.knowledgeChunk.findFirst({
        where: { companyId, contentHash: newHash, id: { not: id } },
      });

      if (collision) {
        throw new BadRequestException(
          'A chunk with identical content already exists in this company knowledge base',
        );
      }

      const newEmbedding = await this.embed(dto.content);
      const embeddingLiteral = this.toVectorLiteral(newEmbedding);

      await this.prisma.$executeRaw`
        UPDATE knowledge_chunks
        SET
          content      = ${dto.content},
          content_hash = ${newHash},
          embedding    = ${embeddingLiteral}::vector,
          source_ref   = COALESCE(${dto.sourceRef ?? null}, source_ref),
          metadata     = COALESCE(${dto.metadata ? JSON.stringify(dto.metadata) : null}::jsonb, metadata),
          is_active    = COALESCE(${dto.isActive ?? null}, is_active),
          updated_at   = NOW()
        WHERE id = ${id} AND company_id = ${companyId}
      `;
    } else {
      // No content change — plain Prisma update (no raw SQL needed)
      const updateData: Prisma.KnowledgeChunkUpdateInput = {};
      if (dto.sourceRef !== undefined) updateData.sourceRef = dto.sourceRef;
      if (dto.metadata !== undefined) {
        // Prisma JSON columns require InputJsonValue (no plain Record acceptance).
        // Round-trip through stringify ensures the value is JSON-serialisable.
        updateData.metadata = JSON.parse(JSON.stringify(dto.metadata)) as Prisma.InputJsonValue;
      }
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      await this.prisma.knowledgeChunk.update({
        where: { id },
        data: updateData,
      });
    }

    return this.findOne(companyId, id);
  }

  /**
   * Soft-delete a chunk (sets deletedAt, excluded from retrieval).
   * Hard purge happens via RetentionPolicy cron.
   */
  async remove(companyId: string, id: string): Promise<void> {
    const chunk = await this.prisma.knowledgeChunk.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!chunk) {
      throw new NotFoundException(`KnowledgeChunk ${id} not found`);
    }

    await this.prisma.knowledgeChunk.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /**
   * Delete all chunks for a given sourceRef within a company.
   * Used by ingest CLI when re-ingesting a document (replace strategy).
   * Returns count of soft-deleted chunks.
   */
  async removeBySourceRef(companyId: string, sourceRef: string): Promise<number> {
    const result = await this.prisma.knowledgeChunk.updateMany({
      where: { companyId, sourceRef, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(
      `Soft-deleted ${result.count} chunks — companyId=${companyId} sourceRef=${sourceRef}`,
    );

    return result.count;
  }

  /**
   * Count active chunks for a company (used by capacity guard + health).
   */
  async countActive(companyId: string): Promise<number> {
    return this.prisma.knowledgeChunk.count({
      where: { companyId, isActive: true, deletedAt: null },
    });
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * SHA-256 hex of content string — idempotency key for upsert guard.
   * Deterministic: same content always produces same hash.
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Convert number[] to pgvector literal string '[0.1,0.2,...]'.
   * Used in tagged template literals for $queryRaw / $executeRaw.
   */
  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Enforce embedding configuration — throws with actionable message.
   * Called at the top of any method that requires OpenAI.
   */
  private assertEmbeddingConfigured(): void {
    if (!this.isEmbeddingConfigured) {
      throw new BadRequestException('Embedding not available: OPENAI_API_KEY is not configured');
    }
  }

  /**
   * Guard against exceeding MAX_CHUNKS_PER_COMPANY.
   * Checked before ingest operations to prevent runaway storage costs.
   */
  private async assertChunkCapacity(companyId: string): Promise<void> {
    const count = await this.countActive(companyId);
    if (count >= MAX_CHUNKS_PER_COMPANY) {
      throw new BadRequestException(
        `Knowledge base capacity exceeded: ${count}/${MAX_CHUNKS_PER_COMPANY} active chunks. ` +
          'Delete unused chunks before ingesting more.',
      );
    }
  }
}
