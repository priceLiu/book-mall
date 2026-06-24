/**
 * Gateway 日志读 API · opportunistic poll 限流（避免状态页每 30s 全量触发厂商轮询）。
 */
import {
  runGatewayPollWorker,
} from "@/lib/gateway/poll-service";
import type { SlowWarnAutoHandlerResult } from "@/lib/generation/slow-warn-auto-handler";
import { runCanvasPollWorker } from "@/lib/canvas/canvas-task-service";
import { isOpportunisticPollFallbackEnabled } from "@/lib/generation/opportunistic-poll";
import { isGenerationPollWorkerProcess } from "@/lib/generation/poll-config";

// 自动 tick（含 poll=1）的合并间隔：日志/状态/轮询池三页 + 多标签同时打开时，
// 同一用户每个周期最多触发一次重量级 poll worker，避免读页面把连接池打满、
// 与「点生成」抢连接（用户反馈的核心瓶颈）。
const MIN_INTERVAL_MS = 15_000;
// force（poll=1）不再完全绕过限流——这些 poll=1 多为前端自动刷新而非真人手点；
// 仅给一个更短的下限，防止连点/多页并发把后台 worker 跑爆。
const FORCED_MIN_INTERVAL_MS = 6_000;
const lastPollAtByUser = new Map<string, number>();
let opportunisticPollInFlight = false;

export type OpportunisticPollOpts = {
  /** 手动刷新：使用更短的限流下限（仍限流，不再完全绕过） */
  force?: boolean;
  /** 明确禁止（历史明细 / 统计只读） */
  skip?: boolean;
};

export type OpportunisticPollScheduleResult = {
  /** 已排队后台 poll（不阻塞 HTTP） */
  scheduled: boolean;
};

async function runOpportunisticGatewayPollBody(): Promise<SlowWarnAutoHandlerResult | undefined> {
  let autoHandler: SlowWarnAutoHandlerResult | undefined;
  try {
    const gw = await runGatewayPollWorker({ limit: 10 });
    autoHandler = gw.autoHandler;
  } catch {
    /* ignore */
  }
  // Canvas 推进由独立 poll-loop / cron 负责。dev:all 下 web 进程跑全量 worker 会占满
  // connection_limit=30，与 SSE / 日志页 / 生成接口抢连接 → pool timeout。
  if (
    isOpportunisticPollFallbackEnabled() ||
    isGenerationPollWorkerProcess()
  ) {
    try {
      await runCanvasPollWorker();
    } catch {
      /* ignore */
    }
  }
  return autoHandler;
}

function tryClaimOpportunisticPoll(
  userId: string,
  opts?: OpportunisticPollOpts,
): boolean {
  if (opts?.skip) return false;
  if (!opts?.force && !isOpportunisticPollFallbackEnabled()) {
    return false;
  }
  if (opportunisticPollInFlight) return false;
  const now = Date.now();
  const last = lastPollAtByUser.get(userId) ?? 0;
  const minInterval = opts?.force ? FORCED_MIN_INTERVAL_MS : MIN_INTERVAL_MS;
  if (now - last < minInterval) return false;
  lastPollAtByUser.set(userId, now);
  opportunisticPollInFlight = true;
  return true;
}

/**
 * 读路径 opportunistic poll：后台单飞执行，**不阻塞** HTTP 响应。
 * 避免日志页 auto-refresh + poll=1 同步等厂商轮询（可达 2min）导致浏览器 Failed to fetch。
 */
export function scheduleOpportunisticGatewayPoll(
  userId: string,
  opts?: OpportunisticPollOpts,
): OpportunisticPollScheduleResult {
  if (!tryClaimOpportunisticPoll(userId, opts)) {
    return { scheduled: false };
  }
  void runOpportunisticGatewayPollBody()
    .catch((e) => {
      console.warn(
        "[gateway] opportunistic poll failed",
        e instanceof Error ? e.message : String(e),
      );
    })
    .finally(() => {
      opportunisticPollInFlight = false;
    });
  return { scheduled: true };
}

/**
 * 轮询池等管理页：需等待 poll 结果（含 slow-warn autoHandler）时使用。
 */
export async function awaitOpportunisticGatewayPoll(
  userId: string,
  opts?: OpportunisticPollOpts,
): Promise<{ ran: boolean; autoHandler?: SlowWarnAutoHandlerResult }> {
  if (opts?.skip) return { ran: false };
  if (!tryClaimOpportunisticPoll(userId, opts)) {
    return { ran: false };
  }
  try {
    const autoHandler = await runOpportunisticGatewayPollBody();
    return { ran: true, autoHandler };
  } finally {
    opportunisticPollInFlight = false;
  }
}

/** @deprecated 使用 scheduleOpportunisticGatewayPoll（读 API）或 awaitOpportunisticGatewayPoll（管理页） */
export async function maybeRunOpportunisticGatewayPoll(
  userId: string,
  opts?: OpportunisticPollOpts,
): Promise<{ ran: boolean; autoHandler?: SlowWarnAutoHandlerResult }> {
  return scheduleOpportunisticGatewayPoll(userId, opts).scheduled
    ? { ran: true }
    : { ran: false };
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
