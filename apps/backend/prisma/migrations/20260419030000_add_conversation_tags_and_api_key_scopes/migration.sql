-- ================================================================
-- Session 47 — Conversation Tags + API Key enhancements
-- ================================================================

-- ----------------------------------------------------------------
-- ApiKey: per-key rate limit + createdBy
-- ----------------------------------------------------------------
ALTER TABLE "api_keys"
  ADD COLUMN "rate_limit_per_min" INTEGER,
  ADD COLUMN "created_by_id" TEXT;

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "api_keys_company_id_is_active_idx"
  ON "api_keys" ("company_id", "is_active");

-- ----------------------------------------------------------------
-- ConversationTag (shared per-tenant tag library)
-- ----------------------------------------------------------------
CREATE TABLE "conversation_tags" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_tags_company_id_name_key"
  ON "conversation_tags" ("company_id", "name");
CREATE INDEX "conversation_tags_company_id_idx"
  ON "conversation_tags" ("company_id");

ALTER TABLE "conversation_tags"
  ADD CONSTRAINT "conversation_tags_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_tags"
  ADD CONSTRAINT "conversation_tags_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------
-- CallTag (many-to-many: Call × ConversationTag)
-- ----------------------------------------------------------------
CREATE TABLE "call_tags" (
    "call_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_tags_pkey" PRIMARY KEY ("call_id", "tag_id")
);

CREATE INDEX "call_tags_tag_id_idx" ON "call_tags" ("tag_id");

ALTER TABLE "call_tags"
  ADD CONSTRAINT "call_tags_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "calls"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_tags"
  ADD CONSTRAINT "call_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "conversation_tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------
-- ChatTag (many-to-many: WhatsappChat × ConversationTag)
-- ----------------------------------------------------------------
CREATE TABLE "chat_tags" (
    "chat_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_tags_pkey" PRIMARY KEY ("chat_id", "tag_id")
);

CREATE INDEX "chat_tags_tag_id_idx" ON "chat_tags" ("tag_id");

ALTER TABLE "chat_tags"
  ADD CONSTRAINT "chat_tags_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "whatsapp_chats"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_tags"
  ADD CONSTRAINT "chat_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "conversation_tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------
-- Full-text search helpers (pg_trgm GIN indexes for ILIKE speed)
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "calls_transcript_trgm_idx"
  ON "calls" USING GIN ("transcript" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "whatsapp_messages_content_trgm_idx"
  ON "whatsapp_messages" USING GIN ("content" gin_trgm_ops);
