-- AR-106: 对账总表预估净成本列
ALTER TABLE "BillingReconciliationMasterLine"
  ADD COLUMN IF NOT EXISTS "platformNetCostYuan" DECIMAL(18, 4);
