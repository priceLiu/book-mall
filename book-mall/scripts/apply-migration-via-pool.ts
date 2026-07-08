/**
 * 经 DATABASE_URL（连接池）应用单条 pending 迁移并写入 _prisma_migrations。
 * 当 `prisma migrate deploy` 因 DIRECT_DATABASE_URL 不可达失败时使用。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/apply-migration-via-pool.ts 20260718120000_ecom_image_processing_credit_price
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";

import { prisma } from "../lib/prisma";

async function main() {
  const name = process.argv[2]?.trim();
  if (!name) {
    console.error("用法: tsx scripts/apply-migration-via-pool.ts <migration_folder_name>");
    process.exit(1);
  }

  const migrationDir = path.join(
    process.cwd(),
    "prisma",
    "migrations",
    name,
  );
  const sqlPath = path.join(migrationDir, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  const existing = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${name}
  `;
  if (existing.length > 0) {
    console.log(`[skip] 迁移已记录: ${name}`);
    return;
  }

  await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (
      "id",
      "checksum",
      "finished_at",
      "migration_name",
      "logs",
      "rolled_back_at",
      "started_at",
      "applied_steps_count"
    ) VALUES (
      gen_random_uuid()::text,
      ${checksum},
      NOW(),
      ${name},
      NULL,
      NULL,
      NOW(),
      1
    )
  `;
  console.log(`[ok] 已应用并记录迁移: ${name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
