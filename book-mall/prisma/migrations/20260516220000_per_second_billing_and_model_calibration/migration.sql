-- 2026-05-16 — 按秒计费 (WalletHold) + 模型校准 (ModelCatalog/ModelAlias)
-- PlatformConfig 新增 4 字段；ToolUsageEvent 新增 billedVideoSec / walletHoldId 用于审计与回查。

-- CreateEnum
CREATE TYPE "WalletHoldStatus" AS ENUM ('HELD', 'SETTLED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ModelAliasSource" AS ENUM (
  'VENDOR_COMMODITY_CODE',
  'VENDOR_BILLABLE_ITEM',
  'VENDOR_RESOURCE_SPEC',
  'VENDOR_PRODUCT_NAME',
  'INTERNAL_TOOLKEY',
  'INTERNAL_ACTION',
  'INTERNAL_SCHEME_A_MODEL',
  'PRICE_MD_LABEL',
  'MANUAL_OTHER'
);

-- CreateEnum
CREATE TYPE "AliasConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'MANUAL');

-- AlterTable: PlatformConfig 新增字段
ALTER TABLE "PlatformConfig" ADD COLUMN "minBilledVideoSec" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "PlatformConfig" ADD COLUMN "minBilledImageCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PlatformConfig" ADD COLUMN "minChargePointsPerInvoke" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PlatformConfig" ADD COLUMN "walletHoldDefaultTtlMin" INTEGER NOT NULL DEFAULT 30;

-- AlterTable: ToolUsageEvent 新增审计字段
ALTER TABLE "ToolUsageEvent" ADD COLUMN "billedVideoSec" INTEGER;
ALTER TABLE "ToolUsageEvent" ADD COLUMN "walletHoldId" TEXT;

-- CreateTable WalletHold
CREATE TABLE "WalletHold" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "action" TEXT,
    "reservedPoints" INTEGER NOT NULL,
    "status" "WalletHoldStatus" NOT NULL DEFAULT 'HELD',
    "taskKey" TEXT,
    "meta" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settledChargePoints" INTEGER,
    "settledUsageEventId" TEXT,
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletHold_userId_taskKey_key" ON "WalletHold"("userId", "taskKey");
CREATE INDEX "WalletHold_userId_status_idx" ON "WalletHold"("userId", "status");
CREATE INDEX "WalletHold_status_expiresAt_idx" ON "WalletHold"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "WalletHold" ADD CONSTRAINT "WalletHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey ToolUsageEvent.walletHoldId -> WalletHold(id)
ALTER TABLE "ToolUsageEvent" ADD CONSTRAINT "ToolUsageEvent_walletHoldId_fkey" FOREIGN KEY ("walletHoldId") REFERENCES "WalletHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ModelCatalog
CREATE TABLE "ModelCatalog" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "defaultTierRaw" TEXT,
    "billingKind" "PricingBillingKind" NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelCatalog_canonicalKey_key" ON "ModelCatalog"("canonicalKey");
CREATE INDEX "ModelCatalog_vendor_active_idx" ON "ModelCatalog"("vendor", "active");

-- CreateTable ModelAlias
CREATE TABLE "ModelAlias" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT,
    "source" "ModelAliasSource" NOT NULL,
    "aliasValue" TEXT NOT NULL,
    "tierRawHint" TEXT,
    "confidence" "AliasConfidence" NOT NULL DEFAULT 'LOW',
    "matchedBy" TEXT,
    "evidence" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelAlias_source_aliasValue_key" ON "ModelAlias"("source", "aliasValue");
CREATE INDEX "ModelAlias_catalogId_source_idx" ON "ModelAlias"("catalogId", "source");
CREATE INDEX "ModelAlias_catalogId_idx" ON "ModelAlias"("catalogId");

ALTER TABLE "ModelAlias" ADD CONSTRAINT "ModelAlias_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ModelCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
