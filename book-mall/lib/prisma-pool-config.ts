/**
 * Prisma 连接池参数解析（供 lib/prisma.ts 与 poll worker 共用）。
 * poll-loop 子进程通过 PRISMA_CONNECTION_LIMIT=1 限制占用；web 进程沿用 DATABASE_URL。
 */

// 直连腾讯云 PG（无 PgBouncer）下，web 进程默认连接预算。10 太小：几个慢查询/瞬时网络抖动
// 就会占满池 → 请求排队到 pool_timeout → 卡死。DB max_connections 余量极大（2048），抬到 30。
const DEV_DEFAULT_CONNECTION_LIMIT = 30;

function readPositiveInt(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** 当前进程 effective connection_limit（与 lib/prisma.ts 注入逻辑一致） */
export function getPrismaConnectionLimit(): number {
  const fromEnv = readPositiveInt(process.env.PRISMA_CONNECTION_LIMIT);
  if (fromEnv) return fromEnv;

  const raw = process.env.DATABASE_URL?.trim();
  if (raw) {
    try {
      const fromUrl = readPositiveInt(
        new URL(raw).searchParams.get("connection_limit") ?? undefined,
      );
      if (fromUrl) return fromUrl;
    } catch {
      /* keep fallback */
    }
  }

  if (process.env.NODE_ENV === "development") return DEV_DEFAULT_CONNECTION_LIMIT;
  return 10;
}

function applyPoolParams(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set(
        "pool_timeout",
        process.env.PRISMA_POOL_TIMEOUT ?? "30",
      );
    }
    // Gen-HotCold-R2 Phase 6：连接预算必须显式生效（所有环境）。
    // 优先 PRISMA_CONNECTION_LIMIT；否则若 URL 未带 connection_limit 则按默认注入，
    // 避免 Web + 多 poll 子进程把远端连接打满（Timed out fetching a new connection）。
    const explicit = process.env.PRISMA_CONNECTION_LIMIT?.trim();
    if (explicit) {
      url.searchParams.set("connection_limit", explicit);
    } else if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        String(
          process.env.NODE_ENV === "development"
            ? DEV_DEFAULT_CONNECTION_LIMIT
            : 10,
        ),
      );
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function resolvePrismaDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  return applyPoolParams(raw);
}

/**
 * 只读副本连接串（Gen-HotCold-R2 Phase 6）。
 * 报表/仪表盘等重读可路由到只读副本，卸载主库写压力。
 * 未配置 DATABASE_REPLICA_URL 时返回 undefined（调用方回退主库）。
 */
export function resolvePrismaReplicaUrl(): string | undefined {
  const raw = process.env.DATABASE_REPLICA_URL?.trim();
  if (!raw) return undefined;
  return applyPoolParams(raw);
}
