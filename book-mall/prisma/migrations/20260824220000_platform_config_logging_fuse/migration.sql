-- 日志与保险丝配置：管理后台 /admin/settings 可调（PlatformConfig > env > 默认）
ALTER TABLE "PlatformConfig"
  ADD COLUMN IF NOT EXISTS "gatewayModelDailyLimit" INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS "gatewayModelDailyLimitOverrides" JSONB,
  ADD COLUMN IF NOT EXISTS "vendorDirectBlockHosts" JSONB,
  ADD COLUMN IF NOT EXISTS "usageReconResidentEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "usageReconIntervalMin" INTEGER NOT NULL DEFAULT 30;
