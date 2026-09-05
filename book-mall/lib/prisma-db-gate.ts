/**
 * Prisma 连接池应用层闸门：Semaphore + P2024 熔断。
 * Prisma 不暴露「池剩余连接数」，因此在 query 入口限制并发借连接，
 * 并在短时内多次 P2024 时快速失败，避免每请求卡满 pool_timeout（30s）。
 */

import { Prisma } from "@prisma/client";
import { getPrismaConnectionLimit } from "@/lib/prisma-pool-config";

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? "");
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

const CIRCUIT_WINDOW_MS = readPositiveInt(
  process.env.PRISMA_DB_CIRCUIT_WINDOW_MS,
  30_000,
);
const CIRCUIT_THRESHOLD = readPositiveInt(
  process.env.PRISMA_DB_CIRCUIT_THRESHOLD,
  5,
);
const CIRCUIT_OPEN_MS = readPositiveInt(
  process.env.PRISMA_DB_CIRCUIT_OPEN_MS,
  10_000,
);

/** 默认关闭；仅 PRISMA_DB_GATE=1|true 时开启（dev:all 多进程下易误伤页面）。 */
export function isPrismaDbGateEnabled(): boolean {
  const flag = process.env.PRISMA_DB_GATE?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

function resolveDbReserve(): number {
  if (!isPrismaDbGateEnabled()) return 0;
  const fromEnv = readPositiveInt(process.env.PRISMA_DB_RESERVE, NaN);
  if (Number.isFinite(fromEnv)) return fromEnv;
  return process.env.NODE_ENV === "development" ? 2 : 5;
}

function resolveAcquireTimeoutMs(): number {
  const fromEnv = readPositiveInt(process.env.PRISMA_DB_ACQUIRE_TIMEOUT_MS, NaN);
  if (Number.isFinite(fromEnv)) return fromEnv;
  return process.env.NODE_ENV === "development" ? 8_000 : 3_000;
}

export class PrismaPoolBusyError extends Error {
  readonly code = "PRISMA_POOL_BUSY";

  constructor(message = "Database connection pool is busy") {
    super(message);
    this.name = "PrismaPoolBusyError";
  }
}

export type PrismaDbGateSnapshot = {
  enabled: boolean;
  connectionLimit: number;
  maxInFlight: number;
  inFlight: number;
  waitQueue: number;
  circuitOpen: boolean;
  circuitOpenUntil: number | null;
  poolTimeoutsInWindow: number;
  acquireTimeoutMs: number;
  reserve: number;
};

let inFlight = 0;
let circuitOpenUntil = 0;
const poolTimeoutTimestamps: number[] = [];

type WaitEntry = {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const waitQueue: WaitEntry[] = [];

export function resolvePrismaDbMaxInFlight(): number {
  return Math.max(1, getPrismaConnectionLimit() - resolveDbReserve());
}

export function getPrismaDbGateSnapshot(): PrismaDbGateSnapshot {
  const now = Date.now();
  prunePoolTimeoutWindow(now);
  return {
    enabled: isPrismaDbGateEnabled(),
    connectionLimit: getPrismaConnectionLimit(),
    maxInFlight: resolvePrismaDbMaxInFlight(),
    inFlight,
    waitQueue: waitQueue.length,
    circuitOpen: now < circuitOpenUntil,
    circuitOpenUntil: circuitOpenUntil > now ? circuitOpenUntil : null,
    poolTimeoutsInWindow: poolTimeoutTimestamps.length,
    acquireTimeoutMs: resolveAcquireTimeoutMs(),
    reserve: resolveDbReserve(),
  };
}

function prunePoolTimeoutWindow(now = Date.now()): void {
  while (
    poolTimeoutTimestamps.length > 0 &&
    poolTimeoutTimestamps[0] < now - CIRCUIT_WINDOW_MS
  ) {
    poolTimeoutTimestamps.shift();
  }
}

export function isPrismaPoolTimeoutError(error: unknown): boolean {
  if (error instanceof PrismaPoolBusyError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2024";
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /Timed out fetching a new connection|connection pool|pool timeout/i.test(
    msg,
  );
}

/** poll / 健康检查：记录 P2024，达阈值则短暂熔断 */
export function recordPrismaPoolTimeout(error: unknown): void {
  if (!isPrismaPoolTimeoutError(error)) return;
  const now = Date.now();
  poolTimeoutTimestamps.push(now);
  prunePoolTimeoutWindow(now);
  if (poolTimeoutTimestamps.length >= CIRCUIT_THRESHOLD) {
    circuitOpenUntil = now + CIRCUIT_OPEN_MS;
    poolTimeoutTimestamps.length = 0;
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[prisma-db-gate] circuit open ${CIRCUIT_OPEN_MS}ms after ${CIRCUIT_THRESHOLD} pool timeouts`,
      );
    }
  }
}

function dequeueWaiter(): void {
  const next = waitQueue.shift();
  if (!next) return;
  clearTimeout(next.timer);
  inFlight += 1;
  next.resolve();
}

export async function acquirePrismaDbSlot(): Promise<void> {
  if (!isPrismaDbGateEnabled()) return;
  const now = Date.now();
  if (now < circuitOpenUntil) {
    throw new PrismaPoolBusyError(
      "Database connection pool circuit is open; retry shortly",
    );
  }

  const max = resolvePrismaDbMaxInFlight();
  if (inFlight < max) {
    inFlight += 1;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const entry: WaitEntry = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const idx = waitQueue.indexOf(entry);
        if (idx >= 0) waitQueue.splice(idx, 1);
        reject(
          new PrismaPoolBusyError(
            `Database connection pool saturated (waited ${resolveAcquireTimeoutMs()}ms)`,
          ),
        );
      }, resolveAcquireTimeoutMs()),
    };
    waitQueue.push(entry);
  });
}

export function releasePrismaDbSlot(): void {
  if (!isPrismaDbGateEnabled()) return;
  inFlight = Math.max(0, inFlight - 1);
  dequeueWaiter();
}

/** 测试 / 热更新：重置闸门状态 */
export function resetPrismaDbGateForTests(): void {
  inFlight = 0;
  circuitOpenUntil = 0;
  poolTimeoutTimestamps.length = 0;
  for (const w of waitQueue.splice(0)) {
    clearTimeout(w.timer);
    w.reject(new PrismaPoolBusyError("gate reset"));
  }
}
