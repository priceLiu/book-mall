-- 七类计费 taxonomy：BYOK + 平台代付报表/结算共用

CREATE TYPE "BillingCategory" AS ENUM (
  'TEXT_TO_IMAGE',
  'IMAGE_TO_VIDEO',
  'VIDEO_TO_VIDEO',
  'VIDEO_UNDERSTANDING',
  'TTS',
  'TEXT',
  'OTHER'
);

ALTER TABLE "GatewayRequestLog"
  ADD COLUMN IF NOT EXISTS "billingCategory" "BillingCategory";

ALTER TABLE "BillingSettlementLine"
  ADD COLUMN IF NOT EXISTS "billingCategory" "BillingCategory";

CREATE INDEX IF NOT EXISTS "GatewayRequestLog_billingCategory_submittedAt_idx"
  ON "GatewayRequestLog"("billingCategory", "submittedAt");

CREATE INDEX IF NOT EXISTS "BillingSettlementLine_billingCategory_periodKey_idx"
  ON "BillingSettlementLine"("billingCategory", "periodKey");
