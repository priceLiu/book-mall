-- 对账总表 / 批次：日历区间（与厂商 CSV 导出窗口一致）
ALTER TABLE "BillingReconciliationRun" ADD COLUMN IF NOT EXISTS "periodFrom" DATE;
ALTER TABLE "BillingReconciliationRun" ADD COLUMN IF NOT EXISTS "periodTo" DATE;
ALTER TABLE "BillingReconciliationRun" ADD COLUMN IF NOT EXISTS "periodKey" TEXT;

ALTER TABLE "BillingReconciliationMasterLine" ADD COLUMN IF NOT EXISTS "periodFrom" DATE;
ALTER TABLE "BillingReconciliationMasterLine" ADD COLUMN IF NOT EXISTS "periodTo" DATE;
ALTER TABLE "BillingReconciliationMasterLine" ADD COLUMN IF NOT EXISTS "periodKey" TEXT;

CREATE INDEX IF NOT EXISTS "BillingReconciliationMasterLine_periodKey_idx"
  ON "BillingReconciliationMasterLine"("periodKey");

CREATE INDEX IF NOT EXISTS "BillingReconciliationMasterLine_importVendor_periodKey_idx"
  ON "BillingReconciliationMasterLine"("importVendor", "periodKey");
