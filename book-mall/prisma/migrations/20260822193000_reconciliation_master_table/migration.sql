-- 对账总表：跨厂商导入 upsert 的持久明细

ALTER TABLE "BillingReconciliationLine"
  ADD COLUMN IF NOT EXISTS "joinKey" TEXT,
  ADD COLUMN IF NOT EXISTS "periodMonth" TEXT;

CREATE TABLE IF NOT EXISTS "BillingReconciliationMasterLine" (
  "id" TEXT NOT NULL,
  "joinKey" TEXT NOT NULL,
  "periodMonth" TEXT NOT NULL,
  "importVendor" TEXT NOT NULL,
  "vendorDisplayName" TEXT,
  "modelKey" TEXT NOT NULL,
  "modelDisplayName" TEXT,
  "tierRaw" TEXT,
  "unitKind" TEXT NOT NULL,
  "tokenDirection" TEXT NOT NULL DEFAULT 'none',
  "userId" TEXT,
  "cloudAccountId" TEXT,
  "vendorUnits" DECIMAL(18,6),
  "platformUnits" DECIMAL(18,6),
  "usageDiff" DECIMAL(18,6),
  "listUnitYuan" DECIMAL(18,8),
  "vendorListYuan" DECIMAL(18,4),
  "platformListYuan" DECIMAL(18,4),
  "amountDiffYuan" DECIMAL(18,4),
  "platformCredits" INTEGER,
  "platformRevenueYuan" DECIMAL(18,4),
  "reconStatus" TEXT,
  "issueReason" TEXT,
  "sampleLogIds" JSONB,
  "sourceRunId" TEXT NOT NULL,
  "sourceImportedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingReconciliationMasterLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingReconciliationMasterLine_joinKey_key"
  ON "BillingReconciliationMasterLine"("joinKey");
CREATE INDEX IF NOT EXISTS "BillingReconciliationMasterLine_periodMonth_idx"
  ON "BillingReconciliationMasterLine"("periodMonth");
CREATE INDEX IF NOT EXISTS "BillingReconciliationMasterLine_importVendor_periodMonth_idx"
  ON "BillingReconciliationMasterLine"("importVendor", "periodMonth");
CREATE INDEX IF NOT EXISTS "BillingReconciliationMasterLine_reconStatus_idx"
  ON "BillingReconciliationMasterLine"("reconStatus");
CREATE INDEX IF NOT EXISTS "BillingReconciliationMasterLine_modelKey_idx"
  ON "BillingReconciliationMasterLine"("modelKey");
