/**
 * 生视频看门狗（影视专业 2.0 收口护栏）。
 *
 * 向厂商主动复核（recoverVolcengineGatewayLogFromVendor）的触发条件：
 *  1. **poll 停滞**：submitted 已久且 lastPolledAt 滞后（worker 卡死 / 单条 poll 阻塞）
 *  2. **墙钟检查点**（默认 300s / 500s / 600s / 900s）：即使 poll 仍在 tick，
 *     厂商 GPU 已完但 status 长期 running、后处理虚高时也强制核对
 *  3. **末档后定期间隔**（默认每 120s）：越过末档后持续复核直至收口
 *
 * 策略见 gateway-video-watchdog-policy.ts；可配置：
 *  - GATEWAY_VIDEO_WATCHDOG_CHECKPOINTS_SEC=300,500,600,900
 *  - GATEWAY_VIDEO_WATCHDOG_RECOVER_GAP_MS（同 log 最小复核间隔，默认 60s）
 *  - GATEWAY_VIDEO_WATCHDOG_INTERVAL_MS（末档后间隔，默认 120s）
 */
import type { Prisma } from "@prisma/client";

import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import {
  attachWatchdogLastRecoverAtMs,
  decideWatchdogVendorCheck,
  readWatchdogLastRecoverAtMs,
  watchdogWorkerStaleMs,
} from "@/lib/gateway/gateway-video-watchdog-policy";
import { recoverVolcengineGatewayLogFromVendor } from "@/lib/gateway/volcengine-stall-recover";
import { prisma } from "@/lib/prisma";

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

const WATCHDOG_LIMIT = () => envInt("GATEWAY_VIDEO_WATCHDOG_LIMIT", 8);
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
  due?: number;
  /** @deprecated 使用 due */
  blocked?: number;
  dueByReason?: Partial<Record<"poll_stale" | "checkpoint" | "interval", number>>;
};

async function markWatchdogRecoverAttempt(
  logId: string,
  resultSummary: unknown,
): Promise<void> {
  const next = attachWatchdogLastRecoverAtMs(resultSummary, Date.now());
  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: { resultSummary: next as Prisma.InputJsonValue },
  });
}

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
      select: {
        id: true,
        submittedAt: true,
        lastPolledAt: true,
        resultSummary: true,
      },
    });
    if (rows.length === 0) return { ran: true, inflight: 0 };

    const workerStaleMs = watchdogWorkerStaleMs();

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

    const dueByReason: GatewayVideoWatchdogResult["dueByReason"] = {};
    const dueRows: Array<{
      id: string;
      resultSummary: unknown;
      reason: NonNullable<
        ReturnType<typeof decideWatchdogVendorCheck>["reason"]
      >;
      checkpointSec?: number;
    }> = [];

    for (const row of rows) {
      const decision = decideWatchdogVendorCheck({
        submittedAtMs: row.submittedAt.getTime(),
        nowMs: now,
        lastPolledAtMs: row.lastPolledAt?.getTime() ?? null,
        lastWatchdogRecoverAtMs: readWatchdogLastRecoverAtMs(row.resultSummary),
      });
      if (!decision.due || !decision.reason) continue;
      dueByReason[decision.reason] =
        (dueByReason[decision.reason] ?? 0) + 1;
      dueRows.push({
        id: row.id,
        resultSummary: row.resultSummary,
        reason: decision.reason,
        checkpointSec: decision.checkpointSec,
      });
    }

    const batch = dueRows.slice(0, WATCHDOG_LIMIT());
    let reconciled = 0;

    if (batch.length > 0) {
      await mapWithConcurrency(
        batch,
        async (row) => {
          try {
            const r = await recoverVolcengineGatewayLogFromVendor(row.id);
            if (r.action === "skipped" && r.message === "recover_busy") {
              return;
            }
            await markWatchdogRecoverAttempt(row.id, row.resultSummary);
            if (
              r.ok &&
              (r.action === "succeeded" || r.action === "vendor_failed")
            ) {
              reconciled += 1;
            }
            if (decisionLogEnabled()) {
              console.info(
                "[gateway-watchdog] vendor check",
                JSON.stringify({
                  source: opts?.source ?? "unknown",
                  logId: row.id,
                  reason: row.reason,
                  checkpointSec: row.checkpointSec,
                  action: r.action,
                  ok: r.ok,
                }),
              );
            }
          } catch (e) {
            console.warn(
              "[gateway-watchdog] reconcile failed",
              row.id,
              e instanceof Error ? e.message : String(e),
            );
          }
        },
        Math.min(4, batch.length),
      );
    }

    return {
      ran: true,
      inflight: rows.length,
      workerStale,
      newestPollLagMs,
      reconciled,
      due: dueRows.length,
      blocked: dueRows.length,
      dueByReason,
    };
  } finally {
    running = false;
  }
}

function decisionLogEnabled(): boolean {
  return process.env.GATEWAY_VIDEO_WATCHDOG_LOG === "1";
}
