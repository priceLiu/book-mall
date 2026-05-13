import { PrismaClient } from "@prisma/client";

/**
 * 挂在 globalThis，避免 dev 热更新重复 `new PrismaClient()`。
 *
 * **Neon / serverless**：请使用控制台提供的 **Pooled** `DATABASE_URL`（通常含 `-pooler` 主机名，
 * 且建议带 `sslmode=require`、`pgbouncer=true`、`connect_timeout=45`）。直连易被远端关掉空闲 TCP，
 * 易出现控制台里的 `PostgreSQL connection: Error { kind: Closed }`。参见 `.env.example`。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
