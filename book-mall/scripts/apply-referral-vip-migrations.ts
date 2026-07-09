/**
 * 手动幂等应用「分享链接 1.0 / VIP / 返佣单」相关列与表。
 *
 * 背景：prisma migrate 引擎经 directUrl 连接被防火墙拦截（P1001），但应用运行时
 * 经 DATABASE_URL 可正常连库。此脚本用运行时 PrismaClient 直接执行等价 DDL（全部
 * IF NOT EXISTS / 幂等），令数据库尽快具备新列/表；待 migrate 可达时再 `migrate deploy`
 * 会因幂等而安全通过。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/apply-referral-vip-migrations.ts
 */
import { prisma } from "../lib/prisma";

const statements: string[] = [
  // PlatformPricingConfig 新列
  `ALTER TABLE "PlatformPricingConfig"
     ADD COLUMN IF NOT EXISTS "welcomeGiftGeneralCredits" INTEGER NOT NULL DEFAULT 500`,
  `ALTER TABLE "PlatformPricingConfig"
     ADD COLUMN IF NOT EXISTS "welcomeGiftVideoCredits" INTEGER NOT NULL DEFAULT 100`,
  `ALTER TABLE "PlatformPricingConfig"
     ADD COLUMN IF NOT EXISTS "referralDefaultRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05`,
  // ReferralPayoutStatus 枚举
  `DO $$ BEGIN
     CREATE TYPE "ReferralPayoutStatus" AS ENUM ('PENDING', 'PAID', 'VOID');
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
  // ReferralPayout 表
  `CREATE TABLE IF NOT EXISTS "ReferralPayout" (
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
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPayout_referrerUserId_periodKey_key"
     ON "ReferralPayout"("referrerUserId", "periodKey")`,
  `CREATE INDEX IF NOT EXISTS "ReferralPayout_periodKey_idx" ON "ReferralPayout"("periodKey")`,
  `CREATE INDEX IF NOT EXISTS "ReferralPayout_status_idx" ON "ReferralPayout"("status")`,
  `DO $$ BEGIN
     ALTER TABLE "ReferralPayout"
       ADD CONSTRAINT "ReferralPayout_referrerUserId_fkey"
       FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
];

async function main() {
  for (let i = 0; i < statements.length; i += 1) {
    const sql = statements[i];
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`[ok] statement ${i + 1}/${statements.length}`);
    } catch (e) {
      console.error(`[fail] statement ${i + 1}:`, (e as Error).message);
      throw e;
    }
  }
  console.log("done: referral/vip DDL applied (idempotent).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
