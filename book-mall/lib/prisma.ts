import { PrismaClient } from "@prisma/client";

/**
 * 挂在 globalThis，避免 dev 热更新重复 `new PrismaClient()`。
 *
 * **Neon / serverless**：请使用控制台提供的 **Pooled** `DATABASE_URL`（通常含 `-pooler` 主机名，
 * 且建议带 `sslmode=require`、`pgbouncer=true`、`connect_timeout=45`）。直连易被远端关掉空闲 TCP，
 * 易出现控制台里的 `PostgreSQL connection: Error { kind: Closed }`。参见 `.env.example`。
 *
 * **dev:all**：book-mall + 多个 poll 子进程共用同一库时，须在 URL 上限制 `connection_limit`，
 * 否则易出现「Timed out fetching a new connection from the connection pool」。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
  });

globalForPrisma.prisma = prisma;
