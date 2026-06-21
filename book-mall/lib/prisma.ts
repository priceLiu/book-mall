import { statSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";

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
    if (process.env.NODE_ENV === "development") {
      // 显式 PRISMA_CONNECTION_LIMIT 优先于 URL 上的 connection_limit：
      // dev:all 里 poll-loop 子进程设 =1（保持 1 连接），book-mall 主进程不设则沿用 URL 值。
      // 否则 URL 上的 connection_limit 会覆盖所有子进程，导致每个 poll-loop 都开满（连接数翻几倍）。
      const explicit = process.env.PRISMA_CONNECTION_LIMIT?.trim();
      if (explicit) {
        url.searchParams.set("connection_limit", explicit);
      } else if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "2");
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const datasourceUrl = resolvePrismaDatasourceUrl();

/**
 * 腾讯云 PostgreSQL **直连**（无 pgbouncer）会回收空闲 TCP 连接，Prisma 复用到失效连接时报
 * `P1017` / `Server has closed the connection` / `kind: Closed`。该错误发生在「连接获取阶段，
 * 查询尚未执行」，故**自动重试**即可换到新连接成功——消除用户「点几次才有反应」。
 * 仅重试连接级错误（见 isPrismaConnectionUnavailable）；业务错误立即抛出。
 * 注：扩展后类型为 DynamicClientExtension，运行时对 model 操作 / $transaction / $queryRaw /
 * $disconnect 完全兼容（代码未使用 $on/$use），对外仍以 PrismaClient 类型导出以兼容全部调用方。
 */
const DB_RETRY_MAX = 2;
const DB_RETRY_BASE_DELAY_MS = 60;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
  });

  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          let lastErr: unknown;
          for (let attempt = 0; attempt <= DB_RETRY_MAX; attempt++) {
            try {
              return await query(args);
            } catch (e) {
              lastErr = e;
              if (!isPrismaConnectionUnavailable(e) || attempt === DB_RETRY_MAX) {
                throw e;
              }
              await sleep(DB_RETRY_BASE_DELAY_MS * (attempt + 1));
            }
          }
          throw lastErr;
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
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
