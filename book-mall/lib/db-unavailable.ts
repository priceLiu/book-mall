import { Prisma } from "@prisma/client";
import { PrismaPoolBusyError } from "@/lib/prisma-db-gate";
import { USER_SYSTEM_BUSY_MESSAGE } from "@/lib/db-user-messages";

const CONNECTION_UNAVAILABLE_RE =
  /Can't reach database server|Server has closed the connection|PrismaClientInitializationError|connection pool|pool timeout|Timed out fetching a new connection|query_wait_timeout|transaction already closed|Transaction API error/i;

/** 统一连接池/不可达错误（prisma 重试耗尽后抛出；error boundary / API 503 识别） */
export class DbUnavailableError extends Error {
  readonly code = "SYSTEM_BUSY";

  constructor(message?: string, readonly cause?: unknown) {
    super(message ?? "Database unavailable");
    this.name = "DbUnavailableError";
  }
}

export function isDbUnavailableError(error: unknown): error is DbUnavailableError {
  return error instanceof DbUnavailableError;
}

export function toDbUnavailableError(error: unknown): DbUnavailableError {
  if (error instanceof DbUnavailableError) return error;
  const message =
    error instanceof Error ? error.message : "Database unavailable";
  return new DbUnavailableError(message, error);
}

/** 数据库不可达、连接池耗尽、连接关闭等：避免整页 500，用于前台读库降级 */
export function isPrismaConnectionUnavailable(error: unknown): boolean {
  if (isDbUnavailableError(error)) return true;
  if (error instanceof PrismaPoolBusyError) return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      error.code === "P1001" ||
      error.code === "P1002" ||
      error.code === "P1008" ||
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

export function prismaConnectionUnavailableMessage(_error?: unknown): string {
  return USER_SYSTEM_BUSY_MESSAGE;
}

export function logDbUnavailable(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[${scope}] database unavailable —`, error);
  }
}
