-- CreateEnum
CREATE TYPE "ContentTypeSchemaStatus" AS ENUM ('FULLY_DISCOVERED', 'PARTIALLY_DISCOVERED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('IMPORTED', 'ANALYZING', 'ANALYSIS_COMPLETED', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "content_types" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "rest_namespace" VARCHAR(100) NOT NULL DEFAULT 'wp/v2',
    "rest_base" VARCHAR(150) NOT NULL,
    "hierarchical" BOOLEAN NOT NULL DEFAULT false,
    "supports" JSONB,
    "taxonomies" JSONB,
    "schema" JSONB,
    "schema_status" "ContentTypeSchemaStatus" NOT NULL DEFAULT 'PARTIALLY_DISCOVERED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_snapshots" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "content_type_id" UUID NOT NULL,
    "wp_post_id" INTEGER NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title" TEXT NOT NULL,
    "raw_content" TEXT,
    "raw_excerpt" TEXT,
    "wp_status" VARCHAR(50) NOT NULL DEFAULT 'publish',
    "wp_url" VARCHAR(512) NOT NULL,
    "wp_published_at" TIMESTAMP(3),
    "wp_modified_at" TIMESTAMP(3),
    "featured_media_id" INTEGER,
    "featured_media_url" VARCHAR(512),
    "original_data" JSONB NOT NULL,
    "taxonomies_data" JSONB,
    "custom_fields" JSONB,
    "workflow_status" "WorkflowStatus" NOT NULL DEFAULT 'IMPORTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_types_website_id_is_active_idx" ON "content_types"("website_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "content_types_website_id_slug_key" ON "content_types"("website_id", "slug");

-- CreateIndex
CREATE INDEX "content_snapshots_website_id_workflow_status_idx" ON "content_snapshots"("website_id", "workflow_status");

-- CreateIndex
CREATE INDEX "content_snapshots_content_type_id_idx" ON "content_snapshots"("content_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_snapshots_website_id_wp_post_id_key" ON "content_snapshots"("website_id", "wp_post_id");

-- AddForeignKey
ALTER TABLE "content_types" ADD CONSTRAINT "content_types_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "content_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
