-- Session 55: Custom fields (Contact) + Usage quotas

-- ==== Enums ====
CREATE TYPE "CustomFieldResource" AS ENUM ('CONTACT');

CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT');

CREATE TYPE "UsageMetric" AS ENUM ('CALLS', 'WHATSAPP_MESSAGES', 'AI_SUGGESTIONS', 'STORAGE_MB');

-- ==== Contact.customFields JSON column ====
ALTER TABLE "contacts"
  ADD COLUMN "custom_fields" JSONB NOT NULL DEFAULT '{}';

-- ==== CustomFieldDefinition ====
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "resource" "CustomFieldResource" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_field_definitions_company_id_resource_key_key"
  ON "custom_field_definitions"("company_id", "resource", "key");

CREATE INDEX "custom_field_definitions_company_id_resource_is_active_idx"
  ON "custom_field_definitions"("company_id", "resource", "is_active");

ALTER TABLE "custom_field_definitions"
  ADD CONSTRAINT "custom_field_definitions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ==== UsageQuota ====
CREATE TABLE "usage_quotas" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "limit" INTEGER NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "warned_thresholds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_quotas_company_id_metric_period_start_key"
  ON "usage_quotas"("company_id", "metric", "period_start");

CREATE INDEX "usage_quotas_company_id_metric_idx"
  ON "usage_quotas"("company_id", "metric");

CREATE INDEX "usage_quotas_period_start_idx"
  ON "usage_quotas"("period_start");

ALTER TABLE "usage_quotas"
  ADD CONSTRAINT "usage_quotas_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
