/**
 * 幂等应用「积分批次 CreditLot」枚举与表。
 *
 * 背景：prisma migrate 引擎经 directUrl 连接被防火墙拦截（P1001），但应用运行时
 * 经 DATABASE_URL 可正常连库。此脚本用运行时 PrismaClient 直接执行等价 DDL（幂等），
 * 待 migrate 可达时再 `migrate deploy` 会因幂等安全通过。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/apply-credit-lot-migration.ts
 */
import { prisma } from "../lib/prisma";

const statements: string[] = [
  `DO $$ BEGIN
     CREATE TYPE "CreditSource" AS ENUM ('SUBSCRIPTION', 'TOPUP', 'FREE');
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE TABLE IF NOT EXISTS "CreditLot" (
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
   )`,
  `CREATE INDEX IF NOT EXISTS "CreditLot_accountId_pool_expiresAt_idx" ON "CreditLot"("accountId", "pool", "expiresAt")`,
  `CREATE INDEX IF NOT EXISTS "CreditLot_expiresAt_idx" ON "CreditLot"("expiresAt")`,
  `DO $$ BEGIN
     ALTER TABLE "CreditLot"
       ADD CONSTRAINT "CreditLot_accountId_fkey"
       FOREIGN KEY ("accountId") REFERENCES "CreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$`,
];

async function main() {
  for (let i = 0; i < statements.length; i += 1) {
    await prisma.$executeRawUnsafe(statements[i]);
    console.log(`[ok] statement ${i + 1}/${statements.length}`);
  }
  console.log("done: CreditLot DDL applied (idempotent).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
