-- AlterTable
ALTER TABLE "content_snapshots" ADD COLUMN     "focus_keyword" VARCHAR(255),
ADD COLUMN     "meta_description" TEXT,
ADD COLUMN     "raw_document" TEXT,
ALTER COLUMN "wp_post_id" DROP NOT NULL,
ALTER COLUMN "slug" DROP NOT NULL,
ALTER COLUMN "wp_status" SET DEFAULT 'draft',
ALTER COLUMN "wp_url" DROP NOT NULL,
ALTER COLUMN "original_data" DROP NOT NULL;
