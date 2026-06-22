import { Prisma } from "@prisma/client";

const CONNECTION_UNAVAILABLE_RE =
  /Can't reach database server|Server has closed the connection|PrismaClientInitializationError|connection pool|pool timeout|Timed out fetching a new connection|transaction already closed|Transaction API error/i;

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

/** @deprecated 使用 isPrismaConnectionUnavailable */
export const isDatabaseUnavailable = isPrismaConnectionUnavailable;

export function prismaConnectionUnavailableMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/connection pool|pool timeout|Timed out fetching a new connection/i.test(msg)) {
    if (process.env.NODE_ENV === "development") {
      return "系统繁忙，任务正在排队重试。dev:all 下请确认 DATABASE_URL 含 connection_limit=20，poll-loop 子进程保持 PRISMA_CONNECTION_LIMIT=1。";
    }
    return "系统繁忙，请稍候再试；任务会自动排队重试。";
  }
  return "系统繁忙，请稍候再试。";
}

export function logDbUnavailable(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[${scope}] database unavailable —`, error);
  }
}
