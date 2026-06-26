/**
 * 生视频看门狗（影视专业 2.0 收口护栏）。
 *
 * 解决「任务跑太久但没人收口」的两类场景，且不依赖某个进程一直活着：
 *  1. **跑太久就主动复核**：RUNNING 火山视频 `submittedAt` 超过 `GATEWAY_VIDEO_WATCHDOG_MS`
 *     （默认 5min）、且最近 `WORKER_STALE_MS` 内没被 poll 过（疑似阻塞），就主动向厂商核对一次
 *     （`recoverVolcengineGatewayLogFromVendor`：含 15s 厂商超时 + 同 logId 去重 + 全局并发封顶）。
 *     厂商终态 → 立即收口；仍在跑 → 保留 RUNNING。不再傻等 90min。
 *  2. **Worker 心跳（跨进程）**：用「在途任务里最新的 `lastPolledAt`」推断 poll worker 是否还在 tick——
 *     有在途任务、却已 `WORKER_STALE_MS` 没有任何任务被 poll，判定 worker 失活并告警。此函数本身挂在
 *     常驻 web 进程的高频端点上，worker 死了它就顶上来主动收口，实现「worker 挂了也不漏收口」。
 *
 * 内部节流：两次实际执行间隔 ≥ `MIN_INTERVAL_MS`，可安全挂到每几秒一次的 web 轮询端点。
 */
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { recoverVolcengineGatewayLogFromVendor } from "@/lib/gateway/volcengine-stall-recover";
import { prisma } from "@/lib/prisma";

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** RUNNING 火山视频「跑太久」主动复核阈值（默认 5min） */
const WATCHDOG_MS = () => envInt("GATEWAY_VIDEO_WATCHDOG_MS", 5 * 60 * 1000);
/** 判定 poll worker 失活 / 单任务「疑似阻塞」的 poll 滞后阈值（默认 90s ≈ 9 个 tick） */
const WORKER_STALE_MS = () =>
  envInt("GATEWAY_VIDEO_WATCHDOG_WORKER_STALE_MS", 90 * 1000);
/** 单次看门狗最多主动复核条数 */
const WATCHDOG_LIMIT = () => envInt("GATEWAY_VIDEO_WATCHDOG_LIMIT", 8);
/** 两次实际执行的最小间隔（节流，防止高频端点反复触发） */
const MIN_INTERVAL_MS = () =>
  envInt("GATEWAY_VIDEO_WATCHDOG_MIN_INTERVAL_MS", 30 * 1000);

let lastRunAt = 0;
let running = false;

export type GatewayVideoWatchdogResult = {
  ran: boolean;
  inflight?: number;
  workerStale?: boolean;
  newestPollLagMs?: number;
  reconciled?: number;
  blocked?: number;
};

/**
 * 运行一次看门狗。节流 + 单飞：被高频调用时大多数会因节流/在跑而直接返回 `ran:false`。
 */
export async function runGatewayVideoWatchdog(opts?: {
  source?: string;
}): Promise<GatewayVideoWatchdogResult> {
  const now = Date.now();
  if (running) return { ran: false };
  if (now - lastRunAt < MIN_INTERVAL_MS()) return { ran: false };
  running = true;
  lastRunAt = now;
  try {
    const rows = await prisma.gatewayRequestLog.findMany({
      where: {
        status: "RUNNING",
        providerKind: "VOLCENGINE",
        requestKind: "VIDEO",
        externalTaskId: { not: null },
      },
      orderBy: { submittedAt: "asc" },
      select: { id: true, submittedAt: true, lastPolledAt: true },
    });
    if (rows.length === 0) return { ran: true, inflight: 0 };

    const workerStaleMs = WORKER_STALE_MS();
    const tooLongMs = WATCHDOG_MS();

    // 跨进程心跳：在途任务里最新的 poll 时刻；过旧 = poll worker 疑似失活
    const newestPollMs = rows.reduce((acc, r) => {
      const t = (r.lastPolledAt ?? r.submittedAt).getTime();
      return t > acc ? t : acc;
    }, 0);
    const newestPollLagMs = now - newestPollMs;
    const workerStale = newestPollLagMs > workerStaleMs;
    if (workerStale) {
      console.warn(
        "[gateway-watchdog] poll worker appears stalled",
        JSON.stringify({
          source: opts?.source ?? "unknown",
          inflight: rows.length,
          newestPollLagSec: Math.round(newestPollLagMs / 1000),
          thresholdSec: Math.round(workerStaleMs / 1000),
        }),
      );
    }

    // 「跑太久 + 最近没被 poll（疑似阻塞）」→ 主动向厂商复核收口
    const blocked = rows.filter((r) => {
      const ageMs = now - r.submittedAt.getTime();
      if (ageMs < tooLongMs) return false;
      const pollLagMs = now - (r.lastPolledAt ?? r.submittedAt).getTime();
      return pollLagMs > workerStaleMs;
    });
    const due = blocked.slice(0, WATCHDOG_LIMIT());

    let reconciled = 0;
    if (due.length > 0) {
      await mapWithConcurrency(
        due,
        async (row) => {
          try {
            const r = await recoverVolcengineGatewayLogFromVendor(row.id);
            if (
              r.ok &&
              (r.action === "succeeded" || r.action === "vendor_failed")
            ) {
              reconciled += 1;
            }
          } catch (e) {
            console.warn(
              "[gateway-watchdog] reconcile failed",
              row.id,
              e instanceof Error ? e.message : String(e),
            );
          }
        },
        Math.min(4, due.length),
      );
    }

    return {
      ran: true,
      inflight: rows.length,
      workerStale,
      newestPollLagMs,
      reconciled,
      blocked: blocked.length,
    };
  } finally {
    running = false;
  }
}
