-- 财务 2.0 升级：视频双池 + 冻结扣费状态机 + 视频专项 M/毛利护栏 + 逐档单价快照 + 调价审批流 + 角色细分
-- 全部为新增字段/表/枚举值（无删除），可安全 deploy。

-- Enum: 积分流水新增冻结状态机类型
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'RESERVE';
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'SETTLE';
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'RELEASE';

-- Enum: 平台角色细分（五级 RBAC）
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OPERATIONS';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Enum: 积分池
CREATE TYPE "CreditPool" AS ENUM ('GENERAL', 'VIDEO');

-- Enum: 调价提案状态
CREATE TYPE "PlanChangeStatus" AS ENUM ('DRAFT', 'SIMULATED', 'FINANCE_REVIEW', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED');

-- PlatformPricingConfig: 视频专项 M/护栏；默认计费秒数 5 → 15
ALTER TABLE "PlatformPricingConfig"
  ADD COLUMN "videoMarginM" DECIMAL(6,3) NOT NULL DEFAULT 4,
  ADD COLUMN "videoMinMarginGuard" DECIMAL(6,4) NOT NULL DEFAULT 0.75;
ALTER TABLE "PlatformPricingConfig" ALTER COLUMN "defaultVideoSec" SET DEFAULT 15;
UPDATE "PlatformPricingConfig" SET "defaultVideoSec" = 15 WHERE "defaultVideoSec" = 5;

-- MembershipPlan: 视频专项池额度 + 逐档「每积分单价」快照
ALTER TABLE "MembershipPlan"
  ADD COLUMN "videoMonthlyCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pricePerCreditYuan" DECIMAL(12,6);
UPDATE "MembershipPlan"
  SET "pricePerCreditYuan" = ROUND("priceYuan" / NULLIF("monthlyCredits", 0), 6)
  WHERE "monthlyCredits" > 0;

-- TeamSeatTier: 每席视频专项额度
ALTER TABLE "TeamSeatTier" ADD COLUMN "perSeatVideoCredits" INTEGER NOT NULL DEFAULT 0;

-- CreditAccount: 视频双池 + 冻结计数 + 档位单价快照
ALTER TABLE "CreditAccount"
  ADD COLUMN "reservedCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "videoBalanceCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "videoMonthlyGrant" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "videoReservedCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pricePerCreditYuan" DECIMAL(12,6);

-- CreditLedger: 积分池标记
ALTER TABLE "CreditLedger" ADD COLUMN "pool" "CreditPool" NOT NULL DEFAULT 'GENERAL';

-- 调价提案审批流
CREATE TABLE "PlanChangeProposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PlanChangeStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "simulation" JSONB,
    "reverseCheck" JSONB,
    "marginPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "financeReviewedBy" TEXT,
    "approvedBy" TEXT,
    "rejectedReason" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanChangeProposal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanChangeProposal_status_createdAt_idx" ON "PlanChangeProposal"("status", "createdAt");

CREATE TABLE "PlanChangeEvent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "fromStatus" "PlanChangeStatus",
    "toStatus" "PlanChangeStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanChangeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanChangeEvent_proposalId_createdAt_idx" ON "PlanChangeEvent"("proposalId", "createdAt");
ALTER TABLE "PlanChangeEvent" ADD CONSTRAINT "PlanChangeEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "PlanChangeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
