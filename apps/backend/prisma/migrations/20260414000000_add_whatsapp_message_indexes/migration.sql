-- Add composite indexes on whatsapp_messages to support analytics queries.
-- Uses CONCURRENTLY to avoid table locks during deployment (PostgreSQL 12+).
-- Refs: ADR-008 (SQL-level aggregation); DDIA Cap. 3 (Indexes).

-- Index supports: getWhatsAppAnalytics filtering by chatId + aiSuggestionUsed + createdAt
CREATE INDEX IF NOT EXISTS "whatsapp_messages_chat_id_ai_suggestion_used_created_at_idx"
ON "whatsapp_messages"("chat_id", "ai_suggestion_used", "created_at" DESC);

-- Index supports: response-rate / direction-based queries
CREATE INDEX IF NOT EXISTS "whatsapp_messages_chat_id_direction_created_at_idx"
ON "whatsapp_messages"("chat_id", "direction", "created_at" DESC);
