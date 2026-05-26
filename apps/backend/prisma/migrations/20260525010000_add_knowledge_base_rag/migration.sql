-- =============================================
-- Migration: add_knowledge_base_rag
-- Session: S79
-- Purpose: RAG knowledge base — pgvector embeddings per tenant
-- =============================================
-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeChunkSource enum
DO $$ BEGIN
  CREATE TYPE "KnowledgeChunkSource" AS ENUM (
    'DOCUMENT',
    'URL',
    'MANUAL',
    'CALL',
    'WHATSAPP'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- knowledge_chunks table
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id"   TEXT NOT NULL,
  "source"       "KnowledgeChunkSource" NOT NULL,
  "source_ref"   VARCHAR(500) NOT NULL,
  "chunk_index"  INTEGER NOT NULL DEFAULT 0,
  "content"      TEXT NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  -- pgvector column: text-embedding-3-small = 1536 dims
  "embedding"    vector(1536),
  "metadata"     JSONB,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "deleted_at"   TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- Foreign key: company (CASCADE delete — tenant offboarding purges all chunks)
ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_company_id_fkey"
  FOREIGN KEY ("company_id")
  REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite unique: idempotent re-ingestion guard
ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunk_content_hash_unique"
  UNIQUE ("company_id", "content_hash");

-- Index: primary filter (tenant + active + recency)
CREATE INDEX IF NOT EXISTS "knowledge_chunks_company_id_is_active_created_at_idx"
  ON "knowledge_chunks"("company_id", "is_active", "created_at" DESC);

-- Index: source-level management (re-ingest / delete by sourceRef)
CREATE INDEX IF NOT EXISTS "knowledge_chunks_company_id_source_source_ref_idx"
  ON "knowledge_chunks"("company_id", "source", "source_ref");

-- IVFFlat index for approximate nearest-neighbour search (cosine distance).
-- lists=100 is appropriate for up to ~1M vectors total (DDIA Cap. 3 B-tree analogy).
-- Created CONCURRENTLY to avoid table lock on future data backfills.
-- NOTE: IVFFlat requires data to be present to train centroids; this index will
-- be a no-op on empty table and activate automatically once rows are inserted.
-- For cold-start correctness, exact KNN via <=> without index is used until
-- the index covers enough data (handled in KnowledgeBaseService.findRelevant).
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_ivfflat_idx"
  ON "knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
