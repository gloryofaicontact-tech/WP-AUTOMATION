-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "websites" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "rest_api_url" VARCHAR(512),
    "username" VARCHAR(100) NOT NULL,
    "application_password" TEXT NOT NULL,
    "status" "WebsiteStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "last_error" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "websites_status_idx" ON "websites"("status");

-- CreateIndex
CREATE INDEX "websites_is_active_idx" ON "websites"("is_active");

-- CreateIndex
CREATE INDEX "websites_created_by_id_idx" ON "websites"("created_by_id");

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
