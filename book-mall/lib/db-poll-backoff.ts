import { isPrismaConnectionUnavailable } from "@/lib/db-unavailable";
import { isRetryableTxError } from "@/lib/db-tx-retry";

/** poll worker 连续 DB 失败时的指数退避（避免 P1001 雪崩）。 */
let consecutivePollDbFailures = 0;

export function isPollWorkerDbError(error: unknown): boolean {
  return isPrismaConnectionUnavailable(error) || isRetryableTxError(error);
}

/** DB 正常时重置计数并返回 baseMs；失败时返回 min(baseMs * 2^n, maxMs)。 */
export function nextPollIntervalMs(
  baseMs: number,
  hadDbError: boolean,
  maxMs = 120_000,
): number {
  if (!hadDbError) {
    consecutivePollDbFailures = 0;
    return baseMs;
  }
  consecutivePollDbFailures += 1;
  const factor = Math.min(consecutivePollDbFailures, 4);
  return Math.min(maxMs, baseMs * 2 ** factor);
}

export function pollDbFailureStreak(): number {
  return consecutivePollDbFailures;
}
