-- 单积分 v2 收尾：合并遗留双池数据并删除字段/枚举

-- 1) 账户余额合并
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

-- 2) 批次/流水池标签统一（列删除前先归一）
UPDATE "CreditLot" SET "pool" = 'GENERAL' WHERE "pool" = 'VIDEO';
UPDATE "CreditLedger" SET "pool" = 'GENERAL' WHERE "pool" = 'VIDEO';
UPDATE "CreditLedgerArchive" SET "pool" = 'GENERAL' WHERE "pool" = 'VIDEO';

-- 3) 注册礼配置合并
UPDATE "PlatformPricingConfig"
SET
  "welcomeGiftGeneralCredits" = "welcomeGiftGeneralCredits" + "welcomeGiftVideoCredits",
  "welcomeGiftVideoCredits" = 0
WHERE "welcomeGiftVideoCredits" <> 0;

UPDATE "MembershipPlan" SET "videoMonthlyCredits" = 0 WHERE "videoMonthlyCredits" <> 0;
UPDATE "TeamSeatTier" SET "perSeatVideoCredits" = 0 WHERE "perSeatVideoCredits" <> 0;

UPDATE "TenantInvite"
SET
  "plannedGeneralCredits" = COALESCE("plannedGeneralCredits", 0) + COALESCE("plannedVideoCredits", 0)
WHERE "plannedVideoCredits" IS NOT NULL AND "plannedVideoCredits" > 0;

-- 4) 运维工单：跨池去重后移除 VIDEO 池列
DELETE FROM "CreditOpsWorkItem" wo
WHERE wo.id IN (
  SELECT ranked.id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY "workType", "accountId", "dueDate", COALESCE("periodKey", '')
        ORDER BY "createdAt" DESC, id DESC
      ) AS rn
    FROM "CreditOpsWorkItem"
  ) ranked
  WHERE ranked.rn > 1
);

DELETE FROM "CreditOpsWorkItem" v
WHERE v."pool" = 'VIDEO'
  AND EXISTS (
    SELECT 1 FROM "CreditOpsWorkItem" g
    WHERE g."workType" = v."workType"
      AND g."accountId" = v."accountId"
      AND g."dueDate" = v."dueDate"
      AND COALESCE(g."periodKey", '') = COALESCE(v."periodKey", '')
      AND g."pool" = 'GENERAL'
  );

UPDATE "CreditOpsWorkItem" SET "pool" = 'GENERAL' WHERE "pool" = 'VIDEO';

ALTER TABLE "CreditOpsWorkItem" DROP CONSTRAINT IF EXISTS "CreditOpsWorkItem_workType_accountId_pool_dueDate_periodKey_key";
ALTER TABLE "CreditOpsWorkItem" DROP COLUMN IF EXISTS "pool";
DROP INDEX IF EXISTS "CreditOpsWorkItem_workType_accountId_dueDate_periodKey_key";
CREATE UNIQUE INDEX "CreditOpsWorkItem_workType_accountId_dueDate_periodKey_key"
  ON "CreditOpsWorkItem"("workType", "accountId", "dueDate", "periodKey");

-- 5) 删账户/套餐/邀请遗留列
ALTER TABLE "CreditAccount" DROP COLUMN IF EXISTS "videoBalanceCredits";
ALTER TABLE "CreditAccount" DROP COLUMN IF EXISTS "videoReservedCredits";
ALTER TABLE "CreditAccount" DROP COLUMN IF EXISTS "videoMonthlyGrant";

ALTER TABLE "MembershipPlan" DROP COLUMN IF EXISTS "videoMonthlyCredits";
ALTER TABLE "TeamSeatTier" DROP COLUMN IF EXISTS "perSeatVideoCredits";
ALTER TABLE "PlatformPricingConfig" DROP COLUMN IF EXISTS "welcomeGiftVideoCredits";
ALTER TABLE "TenantInvite" DROP COLUMN IF EXISTS "plannedVideoCredits";

ALTER TABLE "CreditLedger" DROP COLUMN IF EXISTS "pool";
ALTER TABLE "CreditLot" DROP COLUMN IF EXISTS "pool";
ALTER TABLE "CreditLedgerArchive" DROP COLUMN IF EXISTS "pool";

DROP TYPE IF EXISTS "CreditPool";
