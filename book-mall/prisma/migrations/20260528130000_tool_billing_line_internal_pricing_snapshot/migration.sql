-- 云级明细行：固化对内计价快照（可追溯当时云成本单价、系数、我方单价与公式）
ALTER TABLE "ToolBillingDetailLine"
ADD COLUMN "internalCloudCostUnitYuan" DECIMAL(24,10),
ADD COLUMN "internalRetailMultiplier" DECIMAL(12,6),
ADD COLUMN "internalOurUnitYuan" DECIMAL(24,10),
ADD COLUMN "internalFormulaText" TEXT,
ADD COLUMN "internalChargedPoints" INTEGER,
ADD COLUMN "internalYuanReference" DECIMAL(24,10),
ADD COLUMN "internalCapturedAt" TIMESTAMP(3);
