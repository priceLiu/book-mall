-- LLM 输入/输出分价：ModelCostProfile + ModelCreditPrice
ALTER TABLE "ModelCostProfile"
  ADD COLUMN IF NOT EXISTS "inputListCostYuan" DECIMAL(16, 8),
  ADD COLUMN IF NOT EXISTS "outputListCostYuan" DECIMAL(16, 8);

ALTER TABLE "ModelCreditPrice"
  ADD COLUMN IF NOT EXISTS "inputCreditsPerKToken" INTEGER,
  ADD COLUMN IF NOT EXISTS "outputCreditsPerKToken" INTEGER,
  ADD COLUMN IF NOT EXISTS "inputListPriceYuan" DECIMAL(16, 8),
  ADD COLUMN IF NOT EXISTS "outputListPriceYuan" DECIMAL(16, 8);
