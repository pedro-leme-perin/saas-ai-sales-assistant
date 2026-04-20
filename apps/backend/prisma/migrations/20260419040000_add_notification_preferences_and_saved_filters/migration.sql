-- Session 48: Granular notification preferences + saved filters (smart lists)

-- CreateEnum
CREATE TYPE "FilterResource" AS ENUM ('CALL', 'CHAT');

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "timezone" TEXT,
    "digest_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_preferences_company_id_idx" ON "notification_preferences"("company_id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_digest_mode_idx" ON "notification_preferences"("user_id", "digest_mode");

-- CreateIndex
CREATE UNIQUE INDEX "user_type_channel_unique" ON "notification_preferences"("user_id", "type", "channel");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "resource" "FilterResource" NOT NULL,
    "filter_json" JSONB NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_filters_company_id_resource_idx" ON "saved_filters"("company_id", "resource");

-- CreateIndex
CREATE INDEX "saved_filters_company_id_user_id_idx" ON "saved_filters"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "saved_filters_company_id_is_pinned_idx" ON "saved_filters"("company_id", "is_pinned");

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
