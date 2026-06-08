-- 统一积分计费体系（unified-credit-billing）
-- 新增积分/成本/套餐/席位/BYOK 相关表与枚举，并扩展 GatewayRequestLog 计费快照字段。

-- CreateEnum
CREATE TYPE "CreditChannel" AS ENUM ('OWN', 'CHANNEL', 'RESELLER');
CREATE TYPE "CreditCostUnit" AS ENUM ('PER_SEC', 'PER_IMAGE', 'PER_KTOKEN');
CREATE TYPE "MembershipFamily" AS ENUM ('PERSONAL', 'TEAM');
CREATE TYPE "MembershipInterval" AS ENUM ('MONTH', 'YEAR');
CREATE TYPE "CreditOwnerType" AS ENUM ('USER', 'TENANT');
CREATE TYPE "CreditLedgerType" AS ENUM ('GRANT', 'CONSUME', 'REFUND', 'EXPIRE', 'TOPUP', 'ADJUST');
CREATE TYPE "CreditBillingMode" AS ENUM ('PLATFORM_CREDIT', 'BYOK');
CREATE TYPE "ResourceMeterType" AS ENUM ('OSS_GB_MONTH', 'EGRESS_GB', 'TASK_COUNT');

-- AlterTable: GatewayRequestLog 计费快照
ALTER TABLE "GatewayRequestLog"
  ADD COLUMN "billingMode" "CreditBillingMode",
  ADD COLUMN "canonicalModelKey" TEXT,
  ADD COLUMN "creditsCharged" INTEGER,
  ADD COLUMN "costSnapshotYuan" DECIMAL(16,6),
  ADD COLUMN "marginSnapshot" DECIMAL(6,4),
  ADD COLUMN "seatId" TEXT;

-- CreateTable: PlatformPricingConfig
CREATE TABLE "PlatformPricingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "creditAnchorYuan" DECIMAL(10,4) NOT NULL DEFAULT 0.04,
    "defaultMarginM" DECIMAL(6,3) NOT NULL DEFAULT 2.5,
    "minMarginGuard" DECIMAL(6,4) NOT NULL DEFAULT 0.30,
    "defaultVideoSec" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformPricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ModelCostProfile
CREATE TABLE "ModelCostProfile" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "canonicalModelKey" TEXT NOT NULL,
    "channel" "CreditChannel" NOT NULL DEFAULT 'CHANNEL',
    "credentialId" TEXT,
    "unit" "CreditCostUnit" NOT NULL,
    "tierRaw" TEXT,
    "listCostYuan" DECIMAL(16,8) NOT NULL,
    "discountRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "netCostYuan" DECIMAL(16,8) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModelCostProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModelCostProfile_canonicalModelKey_active_idx" ON "ModelCostProfile"("canonicalModelKey", "active");
CREATE INDEX "ModelCostProfile_vendor_channel_idx" ON "ModelCostProfile"("vendor", "channel");

-- CreateTable: ModelCreditPrice
CREATE TABLE "ModelCreditPrice" (
    "id" TEXT NOT NULL,
    "canonicalModelKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "unit" "CreditCostUnit" NOT NULL,
    "tierRaw" TEXT,
    "netCostYuan" DECIMAL(16,8) NOT NULL,
    "marginM" DECIMAL(6,3) NOT NULL,
    "listPriceYuan" DECIMAL(16,6) NOT NULL,
    "creditsPerUnit" INTEGER NOT NULL,
    "baseMarginRate" DECIMAL(6,4) NOT NULL,
    "formulaSnapshot" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    CONSTRAINT "ModelCreditPrice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModelCreditPrice_canonicalModelKey_key" ON "ModelCreditPrice"("canonicalModelKey");
CREATE INDEX "ModelCreditPrice_active_idx" ON "ModelCreditPrice"("active");

-- CreateTable: MembershipPlan
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "family" "MembershipFamily" NOT NULL,
    "interval" "MembershipInterval" NOT NULL,
    "tier" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priceYuan" DECIMAL(12,2) NOT NULL,
    "originalYuan" DECIMAL(12,2),
    "promoLabel" TEXT,
    "monthlyCredits" INTEGER NOT NULL,
    "includedSeats" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MembershipPlan_family_interval_tier_key" ON "MembershipPlan"("family", "interval", "tier");
CREATE INDEX "MembershipPlan_active_sortOrder_idx" ON "MembershipPlan"("active", "sortOrder");

-- CreateTable: TeamSeatTier
CREATE TABLE "TeamSeatTier" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seatMin" INTEGER NOT NULL,
    "seatMax" INTEGER,
    "perSeatPriceYuan" DECIMAL(12,2) NOT NULL,
    "perSeatCredits" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TeamSeatTier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeamSeatTier_planId_sortOrder_idx" ON "TeamSeatTier"("planId", "sortOrder");
ALTER TABLE "TeamSeatTier" ADD CONSTRAINT "TeamSeatTier_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: CreditAccount
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "ownerType" "CreditOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "balanceCredits" INTEGER NOT NULL DEFAULT 0,
    "monthlyGrantCredits" INTEGER NOT NULL DEFAULT 0,
    "perSeatCapCredits" INTEGER,
    "planId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditAccount_ownerType_ownerId_key" ON "CreditAccount"("ownerType", "ownerId");

-- CreateTable: CreditLedger
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "CreditLedgerType" NOT NULL,
    "credits" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "actorUserId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "costSnapshotYuan" DECIMAL(16,6),
    "idempotencyKey" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditLedger_idempotencyKey_key" ON "CreditLedger"("idempotencyKey");
CREATE INDEX "CreditLedger_accountId_createdAt_idx" ON "CreditLedger"("accountId", "createdAt");
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ByokServiceConfig
CREATE TABLE "ByokServiceConfig" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "techServiceFeeYuan" DECIMAL(12,2) NOT NULL,
    "interval" "MembershipInterval" NOT NULL DEFAULT 'MONTH',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ByokServiceConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ByokServiceConfig_scopeKey_key" ON "ByokServiceConfig"("scopeKey");

-- CreateTable: ResourceMeterRate
CREATE TABLE "ResourceMeterRate" (
    "id" TEXT NOT NULL,
    "resourceType" "ResourceMeterType" NOT NULL,
    "coefficientYuan" DECIMAL(16,8) NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResourceMeterRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResourceMeterRate_resourceType_key" ON "ResourceMeterRate"("resourceType");

-- CreateTable: ResourceMeterEvent
CREATE TABLE "ResourceMeterEvent" (
    "id" TEXT NOT NULL,
    "ownerType" "CreditOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "resourceType" "ResourceMeterType" NOT NULL,
    "quantity" DECIMAL(16,6) NOT NULL,
    "costYuan" DECIMAL(16,6) NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceMeterEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResourceMeterEvent_ownerType_ownerId_periodKey_idx" ON "ResourceMeterEvent"("ownerType", "ownerId", "periodKey");
