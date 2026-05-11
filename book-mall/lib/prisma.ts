import { PrismaClient } from "@prisma/client";

/** 始终挂在 globalThis，避免 dev 热更新或边界情况下重复 new PrismaClient 挤爆连接池 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
