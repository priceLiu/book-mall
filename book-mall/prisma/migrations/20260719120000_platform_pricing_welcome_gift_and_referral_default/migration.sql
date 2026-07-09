-- 分享链接 1.0 / 新用户注册赠送 / 分享返佣默认比例
-- 全部为新增字段（带默认值，无删除），可安全 deploy。

-- PlatformPricingConfig: 注册赠送积分（通用 + 视频，长期有效不清零）+ 分享返佣默认比例
ALTER TABLE "PlatformPricingConfig"
  ADD COLUMN IF NOT EXISTS "welcomeGiftGeneralCredits" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS "welcomeGiftVideoCredits" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "referralDefaultRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05;
