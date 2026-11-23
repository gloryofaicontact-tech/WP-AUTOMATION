-- CreateTable
CREATE TABLE "ai_settings" (
    "id" UUID NOT NULL,
    "active_provider" VARCHAR(50) NOT NULL DEFAULT 'claude',
    "anthropic_api_key" TEXT,
    "gemini_api_key" TEXT,
    "openai_api_key" TEXT,
    "envato_api_token" TEXT,
    "models" JSONB,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);
