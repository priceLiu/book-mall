import { statSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * 挂在 globalThis，避免 dev 热更新重复 `new PrismaClient()`。
 *
 * `prisma generate` 后若仍报 enum 无效，多半是旧 Client 被缓存；按生成物 mtime
 * 自动丢弃旧实例（仍建议 migration 后重启 dev:all 一次）。
 *
 * **Neon / serverless**：请使用控制台提供的 **Pooled** `DATABASE_URL`（通常含 `-pooler` 主机名，
 * 且建议带 `sslmode=require`、`pgbouncer=true`、`connect_timeout=45`）。直连易被远端关掉空闲 TCP，
 * 易出现控制台里的 `PostgreSQL connection: Error { kind: Closed }`。参见 `.env.example`。
 *
 * **dev:all**：book-mall + 多个 poll 子进程共用同一库时，须在 URL 上限制 `connection_limit`，
 * 否则易出现「Timed out fetching a new connection from the connection pool」。
 */
type PrismaGlobal = {
  prisma?: PrismaClient;
  /** node_modules/.prisma/client 生成时间戳 · 用于 prisma generate 后失效旧 Client */
  prismaClientStamp?: string;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

function generatedClientStamp(): string {
  try {
    const p = join(process.cwd(), "node_modules/.prisma/client/index.js");
    return String(statSync(p).mtimeMs);
  } catch {
    return "0";
  }
}

function resolvePrismaDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set(
        "pool_timeout",
        process.env.PRISMA_POOL_TIMEOUT ?? "30",
      );
    }
    if (
      process.env.NODE_ENV === "development" &&
      !url.searchParams.has("connection_limit")
    ) {
      url.searchParams.set(
        "connection_limit",
        process.env.PRISMA_CONNECTION_LIMIT ?? "4",
      );
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const datasourceUrl = resolvePrismaDatasourceUrl();

function buildPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
  });
}

const clientStamp = generatedClientStamp();
if (
  globalForPrisma.prisma &&
  globalForPrisma.prismaClientStamp &&
  globalForPrisma.prismaClientStamp !== clientStamp
) {
  void globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

globalForPrisma.prisma = prisma;
globalForPrisma.prismaClientStamp = clientStamp;
