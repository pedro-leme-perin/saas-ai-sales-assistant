-- Session 52: API request logs (A1) + BULK_ASSIGN_CHATS job type (A2)

-- Extend BackgroundJobType enum for bulk chat assignment jobs
ALTER TYPE "BackgroundJobType" ADD VALUE IF NOT EXISTS 'BULK_ASSIGN_CHATS';

-- Per-tenant API request log (buffered writer; read path for metrics + audit)
CREATE TABLE "api_request_logs" (
  "id"            TEXT PRIMARY KEY,
  "company_id"    TEXT NOT NULL,
  "api_key_id"    TEXT,
  "user_id"       TEXT,
  "method"        VARCHAR(10) NOT NULL,
  "path"          VARCHAR(500) NOT NULL,
  "status_code"   INTEGER NOT NULL,
  "latency_ms"    INTEGER NOT NULL,
  "request_id"    TEXT,
  "ip_address"    TEXT,
  "user_agent"    VARCHAR(500),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "api_request_logs_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "api_request_logs_api_key_fk"
    FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "api_request_logs_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "api_request_logs_company_created_idx"
  ON "api_request_logs" ("company_id", "created_at" DESC);

CREATE INDEX "api_request_logs_company_apikey_created_idx"
  ON "api_request_logs" ("company_id", "api_key_id", "created_at" DESC);

CREATE INDEX "api_request_logs_company_status_created_idx"
  ON "api_request_logs" ("company_id", "status_code", "created_at" DESC);

CREATE INDEX "api_request_logs_company_path_idx"
  ON "api_request_logs" ("company_id", "path");
