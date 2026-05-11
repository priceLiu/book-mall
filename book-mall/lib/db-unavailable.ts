import { Prisma } from "@prisma/client";

/** 数据库不可达、连接关闭等：避免整页 500，用于前台读库降级 */
export function isPrismaConnectionUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1017";
  }
  if (error instanceof Error) {
    return /Can't reach database server|Server has closed the connection|PrismaClientInitializationError/i.test(
      error.message,
    );
  }
  return false;
}

export function logDbUnavailable(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[${scope}] database unavailable —`, error);
  }
}
