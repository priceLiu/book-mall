/**
 * 将「分享/VIP/返佣单」两个迁移标记为已应用（写入 _prisma_migrations）。
 * 因 migrate 引擎经 directUrl 被防火墙拦截，用运行时连接直接登记，
 * checksum 与文件一致，未来 `migrate deploy` 会跳过而不重跑。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/resolve-referral-vip-migrations.ts
 */
import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

import { prisma } from "../lib/prisma";

const MIGRATIONS = [
  "20260719120000_platform_pricing_welcome_gift_and_referral_default",
  "20260719130000_referral_payout",
];

async function main() {
  for (const name of MIGRATIONS) {
    const sqlPath = join(process.cwd(), "prisma", "migrations", name, "migration.sql");
    const content = readFileSync(sqlPath);
    const checksum = createHash("sha256").update(content).digest("hex");

    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1`,
      name,
    );
    if (existing.length > 0) {
      console.log(`[skip] already recorded: ${name}`);
      continue;
    }
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, $3, $4, NULL, NULL, $5, 1)`,
      randomUUID(),
      checksum,
      now,
      name,
      now,
    );
    console.log(`[ok] recorded applied: ${name}`);
  }
  console.log("done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
