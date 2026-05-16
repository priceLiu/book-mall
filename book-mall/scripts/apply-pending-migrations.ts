/* eslint-disable no-console */
/**
 * Workaround：当 Prisma CLI 在本机出现 P1001（schema engine 网络栈与 query engine 不一致）
 * 但 PrismaClient 运行时可连库时，用此脚本把 prisma/migrations 下 `_prisma_migrations`
 * 表中尚未登记的迁移按 timestamp 顺序逐个应用，并写入 finished_at/checksum，
 * 保持与 `prisma migrate deploy` 等效。
 *
 * 用法：dotenv -e .env.local -- tsx scripts/apply-pending-migrations.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

/** 把 migration.sql 拆分为可单独 prepare 执行的语句：
 * - 去除 `--` 行注释
 * - 按 `;` 分割（迁移 SQL 不含函数体/字符串里的分号）
 */
function splitSqlStatements(sql: string): string[] {
  const noComments = sql
    .split("\n")
    .map((line) => {
      const i = line.indexOf("--");
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join("\n");
  return noComments
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const all = readdirSync(MIGRATIONS_DIR)
      .filter((name) => {
        const full = join(MIGRATIONS_DIR, name);
        return statSync(full).isDirectory() && /^\d{14}_/.test(name);
      })
      .sort();

    const applied = await prisma.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>(
      "select migration_name, finished_at, rolled_back_at from _prisma_migrations",
    );
    const appliedOk = new Set(
      applied.filter((m) => m.finished_at && !m.rolled_back_at).map((m) => m.migration_name),
    );

    const pending = all.filter((name) => !appliedOk.has(name));
    if (pending.length === 0) {
      console.log("[apply-pending] 无待应用迁移。");
      return;
    }

    console.log(`[apply-pending] 待应用 ${pending.length} 个迁移：`);
    for (const name of pending) console.log("  -", name);

    for (const name of pending) {
      const sqlPath = join(MIGRATIONS_DIR, name, "migration.sql");
      const sql = readFileSync(sqlPath, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const id = randomUUID();

      console.log(`\n[apply-pending] applying ${name} (${sql.length} bytes)`);

      const statements = splitSqlStatements(sql);
      console.log(`[apply-pending]   ${statements.length} statements`);

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "insert into _prisma_migrations (id, checksum, migration_name, started_at, applied_steps_count) values ($1,$2,$3, now(), 0)",
          id,
          checksum,
          name,
        );
        for (const stmt of statements) {
          await tx.$executeRawUnsafe(stmt);
        }
        await tx.$executeRawUnsafe(
          "update _prisma_migrations set finished_at = now(), applied_steps_count = 1 where id = $1",
          id,
        );
      });

      console.log(`[apply-pending] applied ${name}`);
    }

    console.log("\n[apply-pending] 全部完成。");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[apply-pending] failed:", e);
  process.exit(1);
});
