-- Session 42: Dunning + Payment Recovery
-- Adds payment attempt tracking and dunning schedule to invoices

ALTER TABLE "invoices" ADD COLUMN "payment_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "last_payment_error" TEXT;
ALTER TABLE "invoices" ADD COLUMN "next_dunning_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "dunning_stage" TEXT;

CREATE INDEX "invoices_next_dunning_at_idx" ON "invoices"("next_dunning_at");
