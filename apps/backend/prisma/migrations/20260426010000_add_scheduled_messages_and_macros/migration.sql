-- Session 56: Scheduled WhatsApp messages + Conversation macros
-- Additive migration. Extends BackgroundJobType enum and introduces two new tables.

-- 1. Extend BackgroundJobType enum
ALTER TYPE "BackgroundJobType" ADD VALUE 'SEND_SCHEDULED_MESSAGE';

-- 2. ScheduledMessageStatus enum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELED');

-- 3. scheduled_messages table
CREATE TABLE "scheduled_messages" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "content" TEXT NOT NULL,
    "media_url" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "job_id" TEXT,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_messages_company_id_status_idx" ON "scheduled_messages"("company_id", "status");
CREATE INDEX "scheduled_messages_status_scheduled_at_idx" ON "scheduled_messages"("status", "scheduled_at");
CREATE INDEX "scheduled_messages_chat_id_status_idx" ON "scheduled_messages"("chat_id", "status");

ALTER TABLE "scheduled_messages"
    ADD CONSTRAINT "scheduled_messages_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_messages"
    ADD CONSTRAINT "scheduled_messages_chat_id_fkey"
    FOREIGN KEY ("chat_id") REFERENCES "whatsapp_chats"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. macros table
CREATE TABLE "macros" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "macros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "macros_company_id_name_key" ON "macros"("company_id", "name");
CREATE INDEX "macros_company_id_is_active_idx" ON "macros"("company_id", "is_active");

ALTER TABLE "macros"
    ADD CONSTRAINT "macros_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
