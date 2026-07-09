-- 返佣单（分享返佣结算）：按分享人 + 结算周期出单
-- 新增枚举 + 表，无删除，可安全 deploy。

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReferralPayoutStatus" AS ENUM ('PENDING', 'PAID', 'VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReferralPayout" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "planAmountYuan" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rechargeAmountYuan" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseAmountYuan" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionYuan" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referredCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ReferralPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdByUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPayout_referrerUserId_periodKey_key" ON "ReferralPayout"("referrerUserId", "periodKey");
CREATE INDEX IF NOT EXISTS "ReferralPayout_periodKey_idx" ON "ReferralPayout"("periodKey");
CREATE INDEX IF NOT EXISTS "ReferralPayout_status_idx" ON "ReferralPayout"("status");

-- FK
DO $$ BEGIN
  ALTER TABLE "ReferralPayout"
    ADD CONSTRAINT "ReferralPayout_referrerUserId_fkey"
    FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
