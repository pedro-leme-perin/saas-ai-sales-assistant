-- CreateEnum
CREATE TYPE "CsatTrigger" AS ENUM ('CALL_END', 'CHAT_CLOSE');

-- CreateEnum
CREATE TYPE "CsatChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "CsatResponseStatus" AS ENUM ('SCHEDULED', 'SENT', 'RESPONDED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "timezone" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_interaction_at" TIMESTAMP(3),
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "total_chats" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_notes" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csat_survey_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trigger" "CsatTrigger" NOT NULL,
    "delay_minutes" INTEGER NOT NULL DEFAULT 5,
    "channel" "CsatChannel" NOT NULL DEFAULT 'WHATSAPP',
    "message_tpl" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csat_survey_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csat_responses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "call_id" TEXT,
    "chat_id" TEXT,
    "trigger" "CsatTrigger" NOT NULL,
    "channel" "CsatChannel" NOT NULL,
    "token" TEXT NOT NULL,
    "score" INTEGER,
    "comment" TEXT,
    "status" "CsatResponseStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csat_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_company_id_phone_key" ON "contacts"("company_id", "phone");

-- CreateIndex
CREATE INDEX "contacts_company_id_last_interaction_at_idx" ON "contacts"("company_id", "last_interaction_at");

-- CreateIndex
CREATE INDEX "contacts_company_id_name_idx" ON "contacts"("company_id", "name");

-- CreateIndex
CREATE INDEX "contact_notes_contact_id_created_at_idx" ON "contact_notes"("contact_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "csat_survey_configs_company_id_trigger_key" ON "csat_survey_configs"("company_id", "trigger");

-- CreateIndex
CREATE INDEX "csat_survey_configs_company_id_is_active_idx" ON "csat_survey_configs"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "csat_responses_token_key" ON "csat_responses"("token");

-- CreateIndex
CREATE INDEX "csat_responses_company_id_status_scheduled_for_idx" ON "csat_responses"("company_id", "status", "scheduled_for");

-- CreateIndex
CREATE INDEX "csat_responses_company_id_responded_at_idx" ON "csat_responses"("company_id", "responded_at");

-- CreateIndex
CREATE INDEX "csat_responses_status_scheduled_for_idx" ON "csat_responses"("status", "scheduled_for");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_survey_configs" ADD CONSTRAINT "csat_survey_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_responses" ADD CONSTRAINT "csat_responses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_responses" ADD CONSTRAINT "csat_responses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
