-- =============================================
-- S60a: DSAR (Data Subject Access Requests) — LGPD Art. 18
-- =============================================
-- Adds dsar_requests table for managing data subject rights workflows
-- (ACCESS, PORTABILITY, CORRECTION, DELETION, INFO).
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, ALTER TYPE ADD VALUE IF NOT EXISTS).
-- Backward-compat: existing AuditAction / RetentionResource / BackgroundJobType
-- consumers untouched (only additive enum values).

-- ---------- enum: DsarType -------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DsarType') THEN
        CREATE TYPE "DsarType" AS ENUM ('ACCESS', 'PORTABILITY', 'CORRECTION', 'DELETION', 'INFO');
    END IF;
END$$;

-- ---------- enum: DsarStatus -----------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DsarStatus') THEN
        CREATE TYPE "DsarStatus" AS ENUM (
            'PENDING',
            'APPROVED',
            'REJECTED',
            'PROCESSING',
            'COMPLETED',
            'EXPIRED',
            'FAILED'
        );
    END IF;
END$$;

-- ---------- enum extensions: AuditAction (4 new values) --------------------
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DSAR_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DSAR_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DSAR_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DSAR_COMPLETED';

-- ---------- enum extension: BackgroundJobType (EXTRACT_DSAR) --------------
ALTER TYPE "BackgroundJobType" ADD VALUE IF NOT EXISTS 'EXTRACT_DSAR';

-- ---------- enum extension: RetentionResource (DSAR_ARTIFACTS) ------------
ALTER TYPE "RetentionResource" ADD VALUE IF NOT EXISTS 'DSAR_ARTIFACTS';

-- ---------- table: dsar_requests -------------------------------------------
CREATE TABLE IF NOT EXISTS "dsar_requests" (
    "id"                  TEXT          NOT NULL,
    "company_id"          TEXT          NOT NULL,
    "type"                "DsarType"    NOT NULL,
    "status"              "DsarStatus"  NOT NULL DEFAULT 'PENDING',
    "requester_email"     VARCHAR(254)  NOT NULL,
    "requester_name"      VARCHAR(200),
    "cpf"                 VARCHAR(14),
    "notes"               TEXT,
    "correction_payload"  JSONB,
    "requested_by_id"     TEXT          NOT NULL,
    "approved_by_id"      TEXT,
    "rejected_reason"     TEXT,
    "job_id"              TEXT,
    "download_url"        TEXT,
    "artifact_key"        VARCHAR(500),
    "artifact_bytes"      INTEGER,
    "requested_at"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at"         TIMESTAMP(3),
    "rejected_at"         TIMESTAMP(3),
    "started_at"          TIMESTAMP(3),
    "completed_at"        TIMESTAMP(3),
    "expires_at"          TIMESTAMP(3),
    "created_at"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "dsar_requests_pkey" PRIMARY KEY ("id")
);

-- ---------- indexes (query patterns) ---------------------------------------
-- 1) Listing per tenant, optionally filtered by status — descending by request date.
CREATE INDEX IF NOT EXISTS "dsar_requests_company_id_status_requested_at_idx"
    ON "dsar_requests" ("company_id", "status", "requested_at" DESC);

-- 2) Listing per tenant, filtered by type — descending by request date.
CREATE INDEX IF NOT EXISTS "dsar_requests_company_id_type_requested_at_idx"
    ON "dsar_requests" ("company_id", "type", "requested_at" DESC);

-- 3) Lookup by requester email per tenant (dedupe / activity history).
CREATE INDEX IF NOT EXISTS "dsar_requests_company_id_requester_email_idx"
    ON "dsar_requests" ("company_id", "requester_email");

-- 4) Expiry sweep — cron picks rows with expires_at <= now() and status=COMPLETED.
CREATE INDEX IF NOT EXISTS "dsar_requests_expires_at_idx"
    ON "dsar_requests" ("expires_at");

-- ---------- foreign keys ---------------------------------------------------
-- company_id → companies.id  (CASCADE — tenant lifecycle)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dsar_requests_company_id_fkey'
    ) THEN
        ALTER TABLE "dsar_requests"
            ADD CONSTRAINT "dsar_requests_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- requested_by_id → users.id  (RESTRICT — preserve audit chain)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dsar_requests_requested_by_id_fkey'
    ) THEN
        ALTER TABLE "dsar_requests"
            ADD CONSTRAINT "dsar_requests_requested_by_id_fkey"
            FOREIGN KEY ("requested_by_id") REFERENCES "users"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

-- approved_by_id → users.id  (SET NULL — approver may be deleted, request stays)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dsar_requests_approved_by_id_fkey'
    ) THEN
        ALTER TABLE "dsar_requests"
            ADD CONSTRAINT "dsar_requests_approved_by_id_fkey"
            FOREIGN KEY ("approved_by_id") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$;
