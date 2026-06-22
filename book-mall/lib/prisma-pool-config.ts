/**
 * Prisma 连接池参数解析（供 lib/prisma.ts 与 poll worker 共用）。
 * poll-loop 子进程通过 PRISMA_CONNECTION_LIMIT=1 限制占用；web 进程沿用 DATABASE_URL。
 */

const DEV_DEFAULT_CONNECTION_LIMIT = 20;

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

export function resolvePrismaDatasourceUrl(): string | undefined {
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
      const explicit = process.env.PRISMA_CONNECTION_LIMIT?.trim();
      if (explicit) {
        url.searchParams.set("connection_limit", explicit);
      } else if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set(
          "connection_limit",
          String(DEV_DEFAULT_CONNECTION_LIMIT),
        );
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}
