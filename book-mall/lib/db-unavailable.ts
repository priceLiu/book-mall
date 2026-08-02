import { Prisma } from "@prisma/client";
import { PrismaPoolBusyError } from "@/lib/prisma-db-gate";

const CONNECTION_UNAVAILABLE_RE =
  /Can't reach database server|Server has closed the connection|PrismaClientInitializationError|connection pool|pool timeout|Timed out fetching a new connection|query_wait_timeout|transaction already closed|Transaction API error/i;

/** 数据库不可达、连接池耗尽、连接关闭等：避免整页 500，用于前台读库降级 */
export function isPrismaConnectionUnavailable(error: unknown): boolean {
  if (error instanceof PrismaPoolBusyError) return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      error.code === "P1001" ||
      error.code === "P1017" ||
      error.code === "P2024"
    );
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
  if (error instanceof PrismaPoolBusyError) {
    if (process.env.NODE_ENV === "development") {
      return "系统繁忙（连接池闸门/熔断）。dev:all 可试 pnpm dev:all:nopoll 或查看 http://localhost:3000/dev · /api/dev/health";
    }
    return "系统繁忙，请稍候再试。";
  }
  if (/connection pool|pool timeout|Timed out fetching a new connection|query_wait_timeout/i.test(msg)) {
    if (process.env.NODE_ENV === "development") {
      return "系统繁忙，任务正在排队重试。dev:all 下请确认 DATABASE_URL：经 PgBouncer 时 connection_limit 建议 15；直连 CDB 可用 30。poll-loop 子进程保持 PRISMA_CONNECTION_LIMIT=1。";
    }
    return "系统繁忙，请稍候再试；任务会自动排队重试。";
  }
  if (
    process.env.NODE_ENV === "development" &&
    /Can't reach database server|P1001|Server has closed the connection/i.test(msg)
  ) {
    return "数据库不可达。请检查 book-mall/.env.local 的 DATABASE_URL（运行时连接池地址，勿用 DIRECT_DATABASE_URL）、腾讯云公网白名单与 pnpm --dir book-mall db:ping。";
  }
  return "系统繁忙，请稍候再试。";
}

export function logDbUnavailable(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[${scope}] database unavailable —`, error);
  }
}
