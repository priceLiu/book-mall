-- BillingReconciliationRun/Line v2 fields for Aliyun reconciliation

ALTER TABLE "BillingReconciliationRun"
  ADD COLUMN IF NOT EXISTS "vendor" TEXT DEFAULT 'aliyun',
  ADD COLUMN IF NOT EXISTS "priceMode" TEXT DEFAULT 'list',
  ADD COLUMN IF NOT EXISTS "engineVersion" TEXT DEFAULT 'v2';

ALTER TABLE "BillingReconciliationLine"
  ADD COLUMN IF NOT EXISTS "vendor" TEXT,
  ADD COLUMN IF NOT EXISTS "tierRaw" TEXT,
  ADD COLUMN IF NOT EXISTS "unitKind" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenDirection" TEXT,
  ADD COLUMN IF NOT EXISTS "vendorUnits" DECIMAL(18,6),
  ADD COLUMN IF NOT EXISTS "platformUnits" DECIMAL(18,6),
  ADD COLUMN IF NOT EXISTS "usageDiff" DECIMAL(18,6),
  ADD COLUMN IF NOT EXISTS "listUnitYuan" DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS "vendorListYuan" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "platformListYuan" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "amountDiffYuan" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "platformCredits" INTEGER,
  ADD COLUMN IF NOT EXISTS "platformRevenueYuan" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "reconStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "issueReason" TEXT,
  ADD COLUMN IF NOT EXISTS "sampleLogIds" JSONB;
