-- =============================================
-- Session 45 — Call summaries (persisted) + Team goals
-- =============================================

-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('CALLS_TOTAL', 'CALLS_COMPLETED', 'CONVERSION_RATE', 'AI_ADOPTION_RATE', 'WHATSAPP_MESSAGES');

-- CreateEnum
CREATE TYPE "GoalPeriodType" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "call_summaries" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "keyPoints" TEXT[],
    "sentimentTimeline" JSONB NOT NULL,
    "nextBestAction" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "content_hash" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_summaries_call_id_key" ON "call_summaries"("call_id");

-- CreateIndex
CREATE INDEX "call_summaries_company_id_generated_at_idx" ON "call_summaries"("company_id", "generated_at" DESC);

-- AddForeignKey
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "team_goals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "metric" "GoalMetric" NOT NULL,
    "target" INTEGER NOT NULL,
    "period_type" "GoalPeriodType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_goals_company_id_user_id_metric_period_start_key" ON "team_goals"("company_id", "user_id", "metric", "period_start");

-- CreateIndex
CREATE INDEX "team_goals_company_id_period_start_idx" ON "team_goals"("company_id", "period_start");

-- CreateIndex
CREATE INDEX "team_goals_company_id_user_id_idx" ON "team_goals"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "team_goals_company_id_metric_period_start_idx" ON "team_goals"("company_id", "metric", "period_start");

-- AddForeignKey
ALTER TABLE "team_goals" ADD CONSTRAINT "team_goals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_goals" ADD CONSTRAINT "team_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_goals" ADD CONSTRAINT "team_goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
