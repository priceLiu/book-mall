/**
 * 看门狗 tick 遇 DB 池饱和时：记录熔断、释放闸门占位，避免误杀 RUNNING 任务。
 */
import {
  isPrismaPoolTimeoutError,
  recordPrismaPoolTimeout,
  releasePrismaDbSlot,
} from "@/lib/prisma-db-gate";
import { prisma } from "@/lib/prisma";

let lastDisconnectAt = 0;
const DISCONNECT_COOLDOWN_MS = 30_000;

/** 释放应用层连接压力；必要时对 Prisma 做节流 $disconnect 促池回收。 */
export async function releaseWatchdogDbPressure(error?: unknown): Promise<void> {
  if (error && isPrismaPoolTimeoutError(error)) {
    recordPrismaPoolTimeout(error);
  }
  releasePrismaDbSlot();

  const now = Date.now();
  if (now - lastDisconnectAt < DISCONNECT_COOLDOWN_MS) return;
  if (!error || !isPrismaPoolTimeoutError(error)) return;

  lastDisconnectAt = now;
  try {
    await prisma.$disconnect();
  } catch {
    /* 下轮 query 会自动重连 */
  }
}
