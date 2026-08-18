-- 单积分 v2：合并视频池余额入通用池，清零视频池字段
UPDATE "CreditAccount"
SET
  "balanceCredits" = "balanceCredits" + "videoBalanceCredits",
  "reservedCredits" = "reservedCredits" + "videoReservedCredits",
  "videoBalanceCredits" = 0,
  "videoReservedCredits" = 0,
  "videoMonthlyGrant" = 0
WHERE
  "videoBalanceCredits" <> 0
  OR "videoReservedCredits" <> 0
  OR "videoMonthlyGrant" <> 0;

-- 遗留 VIDEO 批次并入 GENERAL（lot 池标签统一）
UPDATE "CreditLot"
SET "pool" = 'GENERAL'
WHERE "pool" = 'VIDEO';

-- 套餐 seed 视频月积分归零（现网由 seed 脚本维护，迁移兜底）
UPDATE "MembershipPlan"
SET "videoMonthlyCredits" = 0
WHERE "videoMonthlyCredits" <> 0;
