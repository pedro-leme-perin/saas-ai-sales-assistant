-- =============================================
-- S59: AgentSkill + AssignmentRule skill-based routing columns
-- =============================================
-- Adds skill catalogue per agent (agent_skills) and extends assignment_rules
-- with required_skills[] + min_skill_level for skill-based dispatch.
--
-- Idempotency: CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Backward-compat: defaults ensure existing rules behave exactly as before.

-- ---------- agent_skills ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "agent_skills" (
    "id"         TEXT        NOT NULL,
    "company_id" TEXT        NOT NULL,
    "user_id"    TEXT        NOT NULL,
    "skill"      VARCHAR(80) NOT NULL,
    "level"      INTEGER     NOT NULL DEFAULT 3,
    "notes"      VARCHAR(300),
    "is_active"  BOOLEAN     NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- Unique per (user, skill) — a user cannot have the same skill twice.
CREATE UNIQUE INDEX IF NOT EXISTS "agent_skills_user_id_skill_key"
    ON "agent_skills" ("user_id", "skill");

-- Query-pattern indexes.
CREATE INDEX IF NOT EXISTS "agent_skills_company_id_skill_level_idx"
    ON "agent_skills" ("company_id", "skill", "level");

CREATE INDEX IF NOT EXISTS "agent_skills_company_id_user_id_idx"
    ON "agent_skills" ("company_id", "user_id");

-- FKs — CASCADE on company/user delete (tenant & user lifecycle).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agent_skills_company_id_fkey'
    ) THEN
        ALTER TABLE "agent_skills"
            ADD CONSTRAINT "agent_skills_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agent_skills_user_id_fkey'
    ) THEN
        ALTER TABLE "agent_skills"
            ADD CONSTRAINT "agent_skills_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- ---------- assignment_rules: skill-routing columns -----------------------
ALTER TABLE "assignment_rules"
    ADD COLUMN IF NOT EXISTS "required_skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "assignment_rules"
    ADD COLUMN IF NOT EXISTS "min_skill_level" INTEGER;

-- No backfill needed: defaults (empty array / NULL) preserve legacy behaviour.
