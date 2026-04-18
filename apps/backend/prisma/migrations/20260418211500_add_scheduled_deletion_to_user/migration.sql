-- LGPD Art. 16, III — Scheduled hard deletion for user accounts
ALTER TABLE "users" ADD COLUMN "scheduled_deletion_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deletion_reason" TEXT;

-- Index for cron query: WHERE scheduled_deletion_at <= NOW()
CREATE INDEX "users_scheduled_deletion_at_idx" ON "users"("scheduled_deletion_at");
