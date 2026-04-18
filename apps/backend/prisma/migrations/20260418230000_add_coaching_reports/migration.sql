-- Session 44 — Weekly AI coaching reports per vendor
CREATE TABLE "coaching_reports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "insights" TEXT[],
    "recommendations" TEXT[],
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "email_sent_at" TIMESTAMP(3),
    "email_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_reports_pkey" PRIMARY KEY ("id")
);

-- Uniqueness per vendor/week prevents duplicate cron runs
CREATE UNIQUE INDEX "coaching_reports_user_id_week_start_key" ON "coaching_reports"("user_id", "week_start");

-- Query patterns: company dashboards + per-user listings ordered by week
CREATE INDEX "coaching_reports_company_id_week_start_idx" ON "coaching_reports"("company_id", "week_start");
CREATE INDEX "coaching_reports_user_id_week_start_idx" ON "coaching_reports"("user_id", "week_start");

-- Foreign keys with cascade (Company deletion cleans up reports; User deletion likewise)
ALTER TABLE "coaching_reports" ADD CONSTRAINT "coaching_reports_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coaching_reports" ADD CONSTRAINT "coaching_reports_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
