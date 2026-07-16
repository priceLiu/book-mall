/* eslint-disable no-console */
/**
 * 快速检查 DATABASE_URL 是否可达（走运行时连接池，与 dev:all 一致）。
 *
 * 用法：pnpm --dir book-mall db:ping
 */
import { PrismaClient } from "@prisma/client";
import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";

function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("✗ DATABASE_URL 未设置（请在 book-mall/.env.local 配置）");
    process.exit(1);
  }

  console.log("[db:ping] 目标：", maskDatabaseUrl(url));

  const prisma = new PrismaClient();
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`✓ 数据库连接正常（${Date.now() - started}ms）`);
  } catch (error) {
    console.error(`✗ 数据库不可达（${Date.now() - started}ms）`);
    if (isPrismaConnectionUnavailable(error)) {
      console.error("");
      console.error("常见原因（本地开发）：");
      console.error("  1) VPN 未连接 — 腾讯云 CDB 通常在私有网络，需先连 VPN");
      console.error("  2) DATABASE_URL 主机/端口错误 — 运行时走连接池端口，勿与 DIRECT_DATABASE_URL 混用");
      console.error("  3) 连接池耗尽 — dev:all 时 URL 追加 connection_limit=30&pool_timeout=30");
      console.error("");
      console.error("处置：");
      console.error("  · 确认 VPN 后重试：pnpm --dir book-mall db:ping");
      console.error("  · 迁移用池路径：pnpm --dir book-mall db:apply-pending（勿依赖直连 migrate deploy）");
      console.error("  · 详见 docs/dev.md §数据库连接");
    } else if (error instanceof Error) {
      console.error("  ", error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
