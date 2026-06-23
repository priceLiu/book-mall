import { statSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";
import {
  resolvePrismaDatasourceUrl,
  resolvePrismaReplicaUrl,
  getPrismaConnectionLimit,
} from "@/lib/prisma-pool-config";

export { getPrismaConnectionLimit };

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
  /** Gen-HotCold-R2 Phase 6：只读副本 Client（未配置副本时 = 主库实例） */
  prismaRead?: PrismaClient;
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

const datasourceUrl = resolvePrismaDatasourceUrl();

/**
 * 腾讯云 PostgreSQL **直连**（无 pgbouncer）会回收空闲 TCP 连接，Prisma 复用到失效连接时报
 * `P1017` / `Server has closed the connection` / `kind: Closed`。该错误发生在「连接获取阶段，
 * 查询尚未执行」，故**自动重试**即可换到新连接成功——消除用户「点几次才有反应」。
 * 仅重试连接级错误（见 isPrismaConnectionUnavailable）；业务错误立即抛出。
 * 注：扩展后类型为 DynamicClientExtension，运行时对 model 操作 / $transaction / $queryRaw /
 * $disconnect 完全兼容（代码未使用 $on/$use），对外仍以 PrismaClient 类型导出以兼容全部调用方。
 */
const DB_RETRY_MAX = 3;
const DB_RETRY_BASE_DELAY_MS = 60;
/**
 * 重试总时长上限（墙钟）。连接级错误里「池超时 P2024 / Timed out fetching a new connection」
 * 每次失败前已阻塞了 pool_timeout（默认 30s），若再无脑重试 3 次会堆叠到 ~2 分钟，
 * 表现为「点一下卡住几分钟→整页 500→进程被拖垮」。这里给重试设墙钟预算：
 *  - 失败快（连接已关闭 P1017 等，毫秒级返回）→ 仍可在预算内多次重试换到新连接（保留原意图）；
 *  - 失败慢（池已饱和，单次就 ~30s）→ 立即放弃重试、快速抛出「系统繁忙」，绝不再叠加。
 */
const DB_RETRY_BUDGET_MS = (() => {
  const v = Number(process.env.DB_RETRY_BUDGET_MS);
  return Number.isFinite(v) && v > 0 ? v : 8000;
})();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildPrismaClient(urlOverride?: string): PrismaClient {
  const url = urlOverride ?? datasourceUrl;
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          let lastErr: unknown;
          const startedAt = Date.now();
          for (let attempt = 0; attempt <= DB_RETRY_MAX; attempt++) {
            try {
              return await query(args);
            } catch (e) {
              lastErr = e;
              if (
                !isPrismaConnectionUnavailable(e) ||
                attempt === DB_RETRY_MAX ||
                Date.now() - startedAt > DB_RETRY_BUDGET_MS
              ) {
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

/**
 * 只读副本 Client（Gen-HotCold-R2 Phase 6）。
 * 配置 `DATABASE_REPLICA_URL` 时指向只读副本，用于报表/仪表盘等重读，卸载主库；
 * 未配置则复用主库实例（行为不变）。**严禁**用 prismaRead 写库。
 */
const replicaUrl = resolvePrismaReplicaUrl();
export const prismaRead: PrismaClient =
  globalForPrisma.prismaRead ??
  (replicaUrl ? buildPrismaClient(replicaUrl) : prisma);

globalForPrisma.prismaRead = prismaRead;
