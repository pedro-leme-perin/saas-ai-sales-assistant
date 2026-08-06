-- ADR-018 — per-tenant voice number, and the end of "pick the first active company".
--
-- Until this migration the inbound-call path resolved the tenant with
--   company.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
-- which attaches every inbound call to the OLDEST active company regardless of the dialled
-- number. With more than one tenant that is a cross-tenant data leak (recording, transcript,
-- sentiment and AI suggestions of one customer landing in another customer's account).
--
-- `voice_phone_number` is UNIQUE **globally**, not per company, and that is the point: the
-- database now refuses to let two tenants claim the same number, so the routing key cannot be
-- ambiguous no matter what the application layer does.
--
-- Safe to apply online: three nullable columns, no rewrite of existing rows, no lock beyond a
-- brief ACCESS EXCLUSIVE for the catalog update. Production has one Company today, so the
-- unique index builds instantly.

-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "voice_phone_number" TEXT,
  ADD COLUMN "voice_phone_sid" TEXT,
  ADD COLUMN "voice_default_user_id" TEXT;

-- CreateIndex
-- Global uniqueness. Postgres treats NULLs as distinct, so any number of tenants may have no
-- number provisioned yet without colliding with each other.
CREATE UNIQUE INDEX "companies_voice_phone_number_key"
  ON "companies"("voice_phone_number");
