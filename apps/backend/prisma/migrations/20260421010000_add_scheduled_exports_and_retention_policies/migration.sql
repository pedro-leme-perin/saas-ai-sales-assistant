-- Session 51 — Scheduled exports + retention policies

-- CreateEnum
CREATE TYPE "ScheduledExportResource" AS ENUM ('ANALYTICS_OVERVIEW', 'CONTACTS', 'AUDIT_LOGS', 'CALLS', 'WHATSAPP_CHATS', 'CSAT_RESPONSES');

-- CreateEnum
CREATE TYPE "ScheduledExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ScheduledExportRunStatus" AS ENUM ('OK', 'FAILED');

-- CreateEnum
CREATE TYPE "RetentionResource" AS ENUM ('CALLS', 'WHATSAPP_CHATS', 'AUDIT_LOGS', 'AI_SUGGESTIONS', 'CSAT_RESPONSES', 'NOTIFICATIONS');

-- CreateTable
CREATE TABLE "scheduled_exports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "name" TEXT NOT NULL,
    "resource" "ScheduledExportResource" NOT NULL,
    "format" "ScheduledExportFormat" NOT NULL DEFAULT 'CSV',
    "cron_expression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "recipients" TEXT[],
    "filters" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_run_status" "ScheduledExportRunStatus",
    "last_error" TEXT,
    "last_row_count" INTEGER,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_exports_company_id_is_active_idx" ON "scheduled_exports"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "scheduled_exports_is_active_next_run_at_idx" ON "scheduled_exports"("is_active", "next_run_at");

-- AddForeignKey
ALTER TABLE "scheduled_exports" ADD CONSTRAINT "scheduled_exports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "resource" "RetentionResource" NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_deleted_count" INTEGER,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_company_id_resource_key" ON "retention_policies"("company_id", "resource");

-- CreateIndex
CREATE INDEX "retention_policies_company_id_is_active_idx" ON "retention_policies"("company_id", "is_active");

-- AddForeignKey
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
