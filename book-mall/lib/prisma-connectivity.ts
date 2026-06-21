import { Prisma } from "@prisma/client";

/** 数据库短暂不可达（本地连远端 CDB、连接池打满等） */
export function isPrismaConnectivityError(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P1001" || e.code === "P1002" || e.code === "P1008" || e.code === "P1017";
}
