/**
 * Gateway 日志读 API · opportunistic poll 限流（避免状态页每 30s 全量触发厂商轮询）。
 */
import {
  runGatewayPollWorker,
} from "@/lib/gateway/poll-service";
import type { SlowWarnAutoHandlerResult } from "@/lib/generation/slow-warn-auto-handler";
import { runCanvasPollWorker } from "@/lib/canvas/canvas-task-service";
import { isOpportunisticPollFallbackEnabled } from "@/lib/generation/opportunistic-poll";

// 自动 tick（含 poll=1）的合并间隔：日志/状态/轮询池三页 + 多标签同时打开时，
// 同一用户每个周期最多触发一次重量级 poll worker，避免读页面把连接池打满、
// 与「点生成」抢连接（用户反馈的核心瓶颈）。
const MIN_INTERVAL_MS = 15_000;
// force（poll=1）不再完全绕过限流——这些 poll=1 多为前端自动刷新而非真人手点；
// 仅给一个更短的下限，防止连点/多页并发把后台 worker 跑爆。
const FORCED_MIN_INTERVAL_MS = 6_000;
const lastPollAtByUser = new Map<string, number>();

export type OpportunisticPollOpts = {
  /** 手动刷新：使用更短的限流下限（仍限流，不再完全绕过） */
  force?: boolean;
  /** 明确禁止（历史明细 / 统计只读） */
  skip?: boolean;
};

export async function maybeRunOpportunisticGatewayPoll(
  userId: string,
  opts?: OpportunisticPollOpts,
): Promise<{ ran: boolean; autoHandler?: SlowWarnAutoHandlerResult }> {
  if (opts?.skip) return { ran: false };

  // Gen-HotCold-R2 Phase 1：读路径默认不再触发重 poll。
  // 仅「手动刷新(force/poll=1)」或「无后台 poll-loop 的兜底开关」时运行；
  // 进度推进交由独立 poll-loop / cron 负责。
  if (!opts?.force && !isOpportunisticPollFallbackEnabled()) {
    return { ran: false };
  }

  const now = Date.now();
  const last = lastPollAtByUser.get(userId) ?? 0;
  const minInterval = opts?.force ? FORCED_MIN_INTERVAL_MS : MIN_INTERVAL_MS;
  if (now - last < minInterval) {
    return { ran: false };
  }

  lastPollAtByUser.set(userId, now);
  let autoHandler: SlowWarnAutoHandlerResult | undefined;
  try {
    const gw = await runGatewayPollWorker({ limit: 30 });
    autoHandler = gw.autoHandler;
  } catch {
    /* ignore */
  }
  try {
    await runCanvasPollWorker();
  } catch {
    /* ignore */
  }
  return { ran: true, autoHandler };
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
