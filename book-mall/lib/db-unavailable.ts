import { Prisma } from "@prisma/client";

const CONNECTION_UNAVAILABLE_RE =
  /Can't reach database server|Server has closed the connection|PrismaClientInitializationError|connection pool|pool timeout|Timed out fetching a new connection/i;

/** 数据库不可达、连接池耗尽、连接关闭等：避免整页 500，用于前台读库降级 */
export function isPrismaConnectionUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1017";
  }
  if (error instanceof Error) {
    return CONNECTION_UNAVAILABLE_RE.test(error.message);
  }
  return false;
}

export function prismaConnectionUnavailableMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/connection pool|pool timeout|Timed out fetching a new connection/i.test(msg)) {
    return "数据库连接池已满（dev:all 并行进程过多）。请稍后重试，或在 book-mall/.env.local 的 DATABASE_URL 追加 &connection_limit=3&pool_timeout=30 后重启 dev:all。";
  }
  return "数据库暂不可用，请稍后重试。";
}

export function logDbUnavailable(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[${scope}] database unavailable —`, error);
  }
}
