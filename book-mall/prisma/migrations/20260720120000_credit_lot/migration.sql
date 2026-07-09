-- 积分批次（CreditLot）：按来源分别到期的覆盖层
-- 新增枚举 + 表，无删除，可安全 deploy（全部 IF NOT EXISTS / 幂等）。

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CreditSource" AS ENUM ('SUBSCRIPTION', 'TOPUP', 'FREE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreditLot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "pool" "CreditPool" NOT NULL DEFAULT 'GENERAL',
    "source" "CreditSource" NOT NULL,
    "originalCredits" INTEGER NOT NULL,
    "remainingCredits" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "periodKey" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLot_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CreditLot_accountId_pool_expiresAt_idx" ON "CreditLot"("accountId", "pool", "expiresAt");
CREATE INDEX IF NOT EXISTS "CreditLot_expiresAt_idx" ON "CreditLot"("expiresAt");

-- FK
DO $$ BEGIN
  ALTER TABLE "CreditLot"
    ADD CONSTRAINT "CreditLot_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
