-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'ACCOUNT', 'SECURITY');

-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "full_name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(512),
    "phone_no" VARCHAR(20),
    "profile_image" VARCHAR(512),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "account_locked_until" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "last_password_reset_at" TIMESTAMP(3),
    "password_reset_otp_hash" VARCHAR(255),
    "password_reset_expires" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "last_logout_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(45),
    "last_seen_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "device_name" VARCHAR(200),
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT,
    "last_active_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "user_id" BIGINT,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100),
    "entity_id" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "request_id" VARCHAR(100),
    "old_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB,
    "details" JSONB,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSON,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_no_key" ON "User"("phone_no");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_uuid_key" ON "user_sessions"("uuid");

-- CreateIndex
CREATE INDEX "idx_session_uuid" ON "user_sessions"("uuid");

-- CreateIndex
CREATE INDEX "idx_session_user" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_session_token" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_session_user_lru" ON "user_sessions"("user_id", "last_active_at");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_uuid_key" ON "audit_logs"("uuid");

-- CreateIndex
CREATE INDEX "idx_audit_uuid" ON "audit_logs"("uuid");

-- CreateIndex
CREATE INDEX "idx_audit_user_created" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_action_created" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity_created" ON "audit_logs"("entity", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_risk_created" ON "audit_logs"("risk_level", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_flagged_created" ON "audit_logs"("flagged", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_uuid_key" ON "notifications"("uuid");

-- CreateIndex
CREATE INDEX "idx_notification_uuid" ON "notifications"("uuid");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "idx_notification_user_deleted" ON "notifications"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_notification_user_read_deleted" ON "notifications"("user_id", "is_read", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_notification_created" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "idx_notification_type_created" ON "notifications"("type", "created_at");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
