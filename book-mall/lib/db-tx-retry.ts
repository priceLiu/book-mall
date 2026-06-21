import { Prisma } from "@prisma/client";

import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";

/**
 * 可重试的事务级错误：连接不可达/连接池耗尽 + 写冲突/序列化失败/死锁。
 *
 * 说明：`lib/prisma.ts` 的查询扩展只重试 **单条** model 操作的连接级错误，**不覆盖**
 * `$transaction` / `$queryRaw`；而短事务（建任务、claim 提交）在高负载下最容易：
 *  - 拿不到连接 → "Timed out fetching a new connection"；
 *  - Serializable / 行锁竞争 → P2034 write conflict or deadlock。
 * 这些都是**瞬时**错误，重开事务重试即可成功，避免用户「点几次才成功 / 任务未提交」。
 */
export function isRetryableTxError(error: unknown): boolean {
  if (isPrismaConnectionUnavailable(error)) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034: write conflict / deadlock（含 Serializable 序列化失败）
    // P2037: too many database connections
    return error.code === "P2034" || error.code === "P2037";
  }
  if (error instanceof Error) {
    return /write conflict|deadlock|could not serialize|serialization failure|40001|40P01/i.test(
      error.message,
    );
  }
  return false;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 以指数退避重试一个**短事务工厂**。每次重试都重新调用 `fn()`，确保开新事务。
 * 仅重试瞬时错误（见 isRetryableTxError）；业务错误立即抛出。
 */
export async function runTxWithRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseDelayMs?: number; label?: string },
): Promise<T> {
  const max = opts?.maxRetries ?? 3;
  const base = opts?.baseDelayMs ?? 80;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isRetryableTxError(e) || attempt === max) throw e;
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[db-tx-retry] ${opts?.label ?? "tx"} retry ${attempt + 1}/${max}:`,
          e instanceof Error ? e.message : String(e),
        );
      }
      await sleep(base * (attempt + 1) + Math.random() * base);
    }
  }
  throw lastErr;
}
