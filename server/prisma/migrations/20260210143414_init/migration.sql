-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADVERTISER', 'BOTH');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING_PAYMENT', 'FUNDED', 'CREATIVE_PENDING', 'CREATIVE_SUBMITTED', 'CREATIVE_REVISION', 'CREATIVE_APPROVED', 'SCHEDULED', 'POSTED', 'VERIFIED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "AdFormatType" AS ENUM ('POST', 'FORWARD', 'STORY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CreativeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'RELEASE', 'REFUND');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADVERTISER',
    "ton_wallet_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" SERIAL NOT NULL,
    "telegram_chat_id" BIGINT NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "username" TEXT,
    "subscribers" INTEGER NOT NULL DEFAULT 0,
    "avg_views" INTEGER NOT NULL DEFAULT 0,
    "avg_reach" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT,
    "category" TEXT,
    "premium_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bot_is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "stats_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_admins" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "can_manage_deals" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_pricing" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_formats" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "format_type" "AdFormatType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "price_ton" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ad_formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" SERIAL NOT NULL,
    "advertiser_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "budget_ton" DOUBLE PRECISION NOT NULL,
    "target_subscribers_min" INTEGER,
    "target_subscribers_max" INTEGER,
    "target_language" TEXT,
    "target_category" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_applications" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "proposed_price_ton" DOUBLE PRECISION NOT NULL,
    "message" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "advertiser_id" INTEGER NOT NULL,
    "ad_format_id" INTEGER NOT NULL,
    "campaign_id" INTEGER,
    "amount_ton" DOUBLE PRECISION NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "owner_alias" TEXT NOT NULL,
    "advertiser_alias" TEXT NOT NULL,
    "escrow_address" TEXT,
    "escrow_mnemonic_encrypted" TEXT,
    "scheduled_post_at" TIMESTAMP(3),
    "posted_message_id" INTEGER,
    "post_verified_at" TIMESTAMP(3),
    "timeout_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creatives" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "content_text" TEXT,
    "media_url" TEXT,
    "media_type" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_by_id" INTEGER NOT NULL,
    "reviewer_notes" TEXT,
    "status" "CreativeStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount_ton" DOUBLE PRECISION NOT NULL,
    "tx_hash" TEXT,
    "from_address" TEXT,
    "to_address" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_events" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT,
    "actor_id" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_receipts" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "channel_title" TEXT NOT NULL,
    "advertiser_alias" TEXT NOT NULL,
    "owner_alias" TEXT NOT NULL,
    "amount_ton" DOUBLE PRECISION NOT NULL,
    "final_status" TEXT NOT NULL,
    "data_hash" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "channels_telegram_chat_id_key" ON "channels"("telegram_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_admins_channel_id_user_id_key" ON "channel_admins"("channel_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_applications_campaign_id_channel_id_key" ON "campaign_applications"("campaign_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_receipts_deal_id_key" ON "deal_receipts"("deal_id");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_admins" ADD CONSTRAINT "channel_admins_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_admins" ADD CONSTRAINT "channel_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_formats" ADD CONSTRAINT "ad_formats_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_ad_format_id_fkey" FOREIGN KEY ("ad_format_id") REFERENCES "ad_formats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
