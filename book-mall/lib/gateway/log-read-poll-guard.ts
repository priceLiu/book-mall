/**
 * Gateway 日志读 API · opportunistic poll 限流（避免状态页每 30s 全量触发厂商轮询）。
 */
import {
  expireStaleGatewayLogs,
  runGatewayPollWorker,
} from "@/lib/gateway/poll-service";

const MIN_INTERVAL_MS = 10_000;
const lastPollAtByUser = new Map<string, number>();

export type OpportunisticPollOpts = {
  /** 手动刷新：忽略限流 */
  force?: boolean;
  /** 明确禁止（历史明细 / 统计只读） */
  skip?: boolean;
};

export async function maybeRunOpportunisticGatewayPoll(
  userId: string,
  opts?: OpportunisticPollOpts,
): Promise<{ ran: boolean }> {
  if (opts?.skip) return { ran: false };

  const now = Date.now();
  const last = lastPollAtByUser.get(userId) ?? 0;
  if (!opts?.force && now - last < MIN_INTERVAL_MS) {
    return { ran: false };
  }

  lastPollAtByUser.set(userId, now);
  try {
    await runGatewayPollWorker({ limit: 30 });
  } catch {
    /* ignore */
  }
  try {
    await expireStaleGatewayLogs();
  } catch {
    /* ignore */
  }
  return { ran: true };
}

export function parseGatewayLogPollParams(searchParams: URLSearchParams): {
  force: boolean;
  skip: boolean;
} {
  const poll = searchParams.get("poll")?.trim();
  const skipPoll = searchParams.get("skipPoll")?.trim();
  return {
    force: poll === "1" || poll === "true",
    skip: skipPoll === "1" || skipPoll === "true",
  };
}
