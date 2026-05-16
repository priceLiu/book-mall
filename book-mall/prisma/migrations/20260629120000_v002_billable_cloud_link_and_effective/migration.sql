-- v002 P1-1：ToolBillablePrice 回链 PricingSourceLine 的三维度（modelKey/tierRaw/billingKind）。
-- 全部为可空，老数据迁移后保持默认 NULL，不影响线上路径。

ALTER TABLE "ToolBillablePrice"
  ADD COLUMN "cloudModelKey" TEXT,
  ADD COLUMN "cloudTierRaw" TEXT,
  ADD COLUMN "cloudBillingKind" "PricingBillingKind";

CREATE INDEX "ToolBillablePrice_cloudModelKey_cloudTierRaw_cloudBillingKind_idx"
  ON "ToolBillablePrice" ("cloudModelKey", "cloudTierRaw", "cloudBillingKind");

-- v002 P1-3：PricingSourceLine 增加「有效成本」三列，留待对账脚本回填（解析器暂不写）。
ALTER TABLE "PricingSourceLine"
  ADD COLUMN "effectiveDiscount" DOUBLE PRECISION,
  ADD COLUMN "effectivePromoNote" TEXT,
  ADD COLUMN "effectiveCapturedAt" TIMESTAMP(3);
