-- Session 57: Agent presence & capacity + SLA escalation chain

-- Enums
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'AWAY', 'BREAK', 'OFFLINE');
CREATE TYPE "SlaEscalationAction" AS ENUM ('NOTIFY_MANAGER', 'REASSIGN_TO_USER', 'CHANGE_PRIORITY');

-- Extend existing WebhookEvent enum
ALTER TYPE "WebhookEvent" ADD VALUE 'SLA_ESCALATED';

-- Extend whatsapp_chats with escalation tracking (idempotent run ledger)
ALTER TABLE "whatsapp_chats"
  ADD COLUMN "sla_escalations_run" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Agent presence
CREATE TABLE "agent_presence" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
  "status_message" TEXT,
  "max_concurrent_chats" INTEGER NOT NULL DEFAULT 5,
  "last_heartbeat_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_presence_user_id_key" ON "agent_presence"("user_id");
CREATE INDEX "agent_presence_company_id_status_idx" ON "agent_presence"("company_id", "status");
CREATE INDEX "agent_presence_last_heartbeat_at_idx" ON "agent_presence"("last_heartbeat_at");

ALTER TABLE "agent_presence"
  ADD CONSTRAINT "agent_presence_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SLA escalations
CREATE TABLE "sla_escalations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "policy_id" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "trigger_after_mins" INTEGER NOT NULL,
  "action" "SlaEscalationAction" NOT NULL,
  "target_user_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "target_priority" "ChatPriority",
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sla_escalations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sla_escalations_policy_id_level_key" ON "sla_escalations"("policy_id", "level");
CREATE INDEX "sla_escalations_company_id_is_active_idx" ON "sla_escalations"("company_id", "is_active");
CREATE INDEX "sla_escalations_policy_id_idx" ON "sla_escalations"("policy_id");

ALTER TABLE "sla_escalations"
  ADD CONSTRAINT "sla_escalations_policy_id_fkey"
  FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_escalations"
  ADD CONSTRAINT "sla_escalations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
