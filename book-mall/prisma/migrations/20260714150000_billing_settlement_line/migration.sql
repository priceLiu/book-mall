-- Book 统一结算流水 + Gateway 结算快照字段

CREATE TYPE "BillingSettlementKind" AS ENUM (
  'BYOK_QUOTA_INCLUDED',
  'BYOK_QUOTA_OVERAGE',
  'PLATFORM_CREDIT',
  'PLATFORM_VIDEO',
  'METER_ONLY',
  'NONE'
);

ALTER TABLE "GatewayRequestLog"
  ADD COLUMN IF NOT EXISTS "settlementKind" "BillingSettlementKind",
  ADD COLUMN IF NOT EXISTS "byokTaskKind" "ByokTaskKind",
  ADD COLUMN IF NOT EXISTS "quotaDelta" INTEGER,
  ADD COLUMN IF NOT EXISTS "includedUsedAfter" INTEGER,
  ADD COLUMN IF NOT EXISTS "includedRemainingAfter" INTEGER;

CREATE INDEX IF NOT EXISTS "GatewayRequestLog_settlementKind_submittedAt_idx"
  ON "GatewayRequestLog"("settlementKind", "submittedAt");
CREATE INDEX IF NOT EXISTS "GatewayRequestLog_actorBookUserId_settlementKind_idx"
  ON "GatewayRequestLog"("actorBookUserId", "settlementKind");

CREATE TABLE "BillingSettlementLine" (
  "id" TEXT NOT NULL,
  "gatewayLogId" TEXT NOT NULL,
  "ownerType" "CreditOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "actorBookUserId" TEXT,
  "periodKey" TEXT NOT NULL,
  "settlementKind" "BillingSettlementKind" NOT NULL,
  "byokTaskKind" "ByokTaskKind",
  "tryonModelKey" TEXT,
  "quotaDelta" INTEGER NOT NULL DEFAULT 0,
  "monthlyIncluded" INTEGER,
  "includedUsedAfter" INTEGER,
  "includedRemainingAfter" INTEGER,
  "isOverage" BOOLEAN NOT NULL DEFAULT false,
  "creditsCharged" INTEGER NOT NULL DEFAULT 0,
  "creditLedgerId" TEXT,
  "canonicalModelKey" TEXT,
  "requestKind" "GatewayRequestKind",
  "clientPage" TEXT,
  "feeDescription" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingSettlementLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingSettlementLine_gatewayLogId_key" ON "BillingSettlementLine"("gatewayLogId");
CREATE INDEX "BillingSettlementLine_ownerType_ownerId_periodKey_idx"
  ON "BillingSettlementLine"("ownerType", "ownerId", "periodKey");
CREATE INDEX "BillingSettlementLine_actorBookUserId_periodKey_idx"
  ON "BillingSettlementLine"("actorBookUserId", "periodKey");
CREATE INDEX "BillingSettlementLine_settlementKind_submittedAt_idx"
  ON "BillingSettlementLine"("settlementKind", "submittedAt");
CREATE INDEX "BillingSettlementLine_byokTaskKind_periodKey_idx"
  ON "BillingSettlementLine"("byokTaskKind", "periodKey");
