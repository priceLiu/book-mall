-- 方案 A：按工具 + 模型 id 覆盖零售系数（未命中行仍用全局 ToolRetailMultiplierRule）

CREATE TABLE "ToolSchemeAModelRetailMultiplier" (
    "id" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolSchemeAModelRetailMultiplier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ToolSchemeAModelRetailMultiplier_toolKey_modelKey_effectiveFrom_idx" ON "ToolSchemeAModelRetailMultiplier"("toolKey", "modelKey", "effectiveFrom");
