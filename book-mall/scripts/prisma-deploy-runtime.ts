/**
 * prisma migrate deploy 在 DIRECT_DATABASE_URL 不可达时的替代方案。
 * 经 PgBouncer 的 DATABASE_URL 顺序执行未应用的 migration.sql，并写入 _prisma_migrations。
 *
 * 用法：pnpm db:deploy:runtime
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";

const MIGRATIONS_DIR = join(process.cwd(), "prisma/migrations");

function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function appliedNames(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE rolled_back_at IS NULL
  `;
  return new Set(rows.map((r) => r.migration_name));
}

async function main() {
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_/.test(name))
    .sort();

  const done = await appliedNames();
  const todo = pending.filter((name) => !done.has(name));

  if (todo.length === 0) {
    console.log("✓ 无待应用 migration（runtime 路径）。");
    return;
  }

  console.log(`待应用 ${todo.length} 个 migration（经 DATABASE_URL）：`);
  for (const name of todo) {
    const sqlPath = join(MIGRATIONS_DIR, name, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    console.log(`  → ${name}`);
    await prisma.$executeRawUnsafe(sql);
    const checksum = migrationChecksum(sql);
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (
        id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
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
    console.log(`    ✓ 已应用`);
  }
  console.log("✓ runtime migrate deploy 完成。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
