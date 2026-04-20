-- Session 49: Background jobs queue + SLA policies

-- Extend enums
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SLA_ALERT';
ALTER TYPE "WebhookEvent"     ADD VALUE IF NOT EXISTS 'SLA_BREACHED';

-- New enums
CREATE TYPE "BackgroundJobType" AS ENUM (
  'REGENERATE_CALL_SUMMARIES',
  'RECOMPUTE_COACHING_REPORTS',
  'BULK_DELETE_CALLS',
  'BULK_TAG_CALLS',
  'EXPORT_ANALYTICS'
);

CREATE TYPE "BackgroundJobStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'DEAD_LETTER',
  'CANCELED'
);

-- BackgroundJob table
CREATE TABLE "background_jobs" (
  "id"             TEXT                  PRIMARY KEY,
  "company_id"     TEXT                  NOT NULL,
  "created_by_id"  TEXT,
  "type"           "BackgroundJobType"   NOT NULL,
  "status"         "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload"        JSONB                 NOT NULL DEFAULT '{}',
  "result"         JSONB,
  "progress"       INTEGER               NOT NULL DEFAULT 0,
  "attempts"       INTEGER               NOT NULL DEFAULT 0,
  "max_attempts"   INTEGER               NOT NULL DEFAULT 5,
  "run_at"         TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at"     TIMESTAMP(3),
  "finished_at"    TIMESTAMP(3),
  "last_error"     TEXT,
  "created_at"     TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "background_jobs"
  ADD CONSTRAINT "background_jobs_company_fk"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;

ALTER TABLE "background_jobs"
  ADD CONSTRAINT "background_jobs_creator_fk"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "background_jobs_company_status_idx" ON "background_jobs" ("company_id", "status");
CREATE INDEX "background_jobs_status_runat_idx"  ON "background_jobs" ("status", "run_at");
CREATE INDEX "background_jobs_company_type_ts_idx" ON "background_jobs" ("company_id", "type", "created_at");

-- SlaPolicy table
CREATE TABLE "sla_policies" (
  "id"              TEXT           PRIMARY KEY,
  "company_id"      TEXT           NOT NULL,
  "name"            TEXT           NOT NULL,
  "priority"        "ChatPriority" NOT NULL,
  "response_mins"   INTEGER        NOT NULL,
  "resolution_mins" INTEGER        NOT NULL,
  "is_active"       BOOLEAN        NOT NULL DEFAULT TRUE,
  "created_at"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "sla_policies"
  ADD CONSTRAINT "sla_policies_company_fk"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "sla_company_priority_unique" ON "sla_policies" ("company_id", "priority");
CREATE INDEX "sla_policies_company_active_idx"   ON "sla_policies" ("company_id", "is_active");

-- WhatsappChat: SLA tracking columns
ALTER TABLE "whatsapp_chats"
  ADD COLUMN "first_agent_reply_at"     TIMESTAMP(3),
  ADD COLUMN "resolved_at"              TIMESTAMP(3),
  ADD COLUMN "sla_response_breached"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "sla_resolution_breached"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "sla_breached_at"          TIMESTAMP(3);

CREATE INDEX "whatsapp_chats_company_status_priority_idx"
  ON "whatsapp_chats" ("company_id", "status", "priority");
