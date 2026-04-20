-- Session 54: Assignment rules + IMPORT_CONTACTS background job type

-- Add IMPORT_CONTACTS to BackgroundJobType enum
ALTER TYPE "BackgroundJobType" ADD VALUE 'IMPORT_CONTACTS';

-- AssignmentStrategy enum
CREATE TYPE "AssignmentStrategy" AS ENUM ('ROUND_ROBIN', 'LEAST_BUSY', 'MANUAL_ONLY');

-- AssignmentRule table
CREATE TABLE "assignment_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "strategy" "AssignmentStrategy" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "target_user_ids" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assignment_rule_name_unique" ON "assignment_rules"("company_id", "name");
CREATE INDEX "assignment_rules_company_id_is_active_priority_idx" ON "assignment_rules"("company_id", "is_active", "priority");

ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
