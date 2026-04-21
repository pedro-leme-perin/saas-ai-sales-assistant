-- =============================================
-- Session 58 — Admin impersonation + Config versioning
-- =============================================

-- CreateEnum
CREATE TYPE "ConfigResource" AS ENUM (
  'COMPANY_SETTINGS',
  'FEATURE_FLAG',
  'SLA_POLICY',
  'ASSIGNMENT_RULE',
  'NOTIFICATION_PREFERENCES'
);

-- AlterEnum AuditAction (IMPERSONATE_START, IMPERSONATE_END, ROLLBACK)
ALTER TYPE "AuditAction" ADD VALUE 'IMPERSONATE_START';
ALTER TYPE "AuditAction" ADD VALUE 'IMPERSONATE_END';
ALTER TYPE "AuditAction" ADD VALUE 'ROLLBACK';

-- =============================================
-- ImpersonationSession
-- =============================================
CREATE TABLE "impersonation_sessions" (
  "id"             TEXT NOT NULL,
  "company_id"     TEXT NOT NULL,
  "actor_user_id"  TEXT NOT NULL,
  "target_user_id" TEXT NOT NULL,
  "reason"         TEXT NOT NULL,
  "token_hash"     TEXT NOT NULL,
  "ip_address"     TEXT,
  "user_agent"     TEXT,
  "expires_at"     TIMESTAMP(3) NOT NULL,
  "ended_at"       TIMESTAMP(3),
  "ended_reason"   TEXT,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "impersonation_sessions_token_hash_key" ON "impersonation_sessions"("token_hash");
CREATE INDEX "impersonation_sessions_company_id_is_active_idx" ON "impersonation_sessions"("company_id", "is_active");
CREATE INDEX "impersonation_sessions_actor_user_id_idx" ON "impersonation_sessions"("actor_user_id");
CREATE INDEX "impersonation_sessions_target_user_id_idx" ON "impersonation_sessions"("target_user_id");
CREATE INDEX "impersonation_sessions_expires_at_idx" ON "impersonation_sessions"("expires_at");

ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- ConfigSnapshot
-- =============================================
CREATE TABLE "config_snapshots" (
  "id"               TEXT NOT NULL,
  "company_id"       TEXT NOT NULL,
  "resource"         "ConfigResource" NOT NULL,
  "resource_id"      TEXT,
  "label"            TEXT,
  "snapshot_data"    JSONB NOT NULL,
  "created_by_id"    TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "config_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "config_snapshots_company_id_resource_created_at_idx" ON "config_snapshots"("company_id", "resource", "created_at" DESC);
CREATE INDEX "config_snapshots_company_id_resource_id_idx" ON "config_snapshots"("company_id", "resource_id");
CREATE INDEX "config_snapshots_created_by_id_idx" ON "config_snapshots"("created_by_id");

ALTER TABLE "config_snapshots" ADD CONSTRAINT "config_snapshots_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "config_snapshots" ADD CONSTRAINT "config_snapshots_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
