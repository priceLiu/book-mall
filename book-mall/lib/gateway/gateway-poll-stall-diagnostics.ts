/**
 * Gateway poll · Poll Δ 停摆诊断（batch 饿死 / worker 失败 / 厂商超时）。
 */
import type { Prisma } from "@prisma/client";

import {
  VOLCENGINE_GATEWAY_POLL_GAP_MS,
  readVolcengineTimingTrace,
} from "@/lib/gateway/log-volcengine-timing";
import { prisma } from "@/lib/prisma";

export type GatewayPollStallCause =
  | "batch_starved_slow_queue"
  | "batch_starved_normal_queue"
  | "poll_loop_tick_failed"
  | "poll_vendor_timeout"
  | "poll_db_error"
  | "poll_worker_stale"
  | "unknown";

export type GatewayPollLastAttempt = {
  at: string;
  ok: boolean;
  kind: "vendor" | "db";
  error?: string;
};

export type GatewayPollStallDiagnostic = {
  kind: "gateway_poll_stall";
  checkedAt: string;
  pollLagMs: number;
  pollLagSec: number;
  cause: GatewayPollStallCause;
  hint: string;
  batchLimit?: number;
  slowRunningTotal?: number;
  selectedThisTick?: boolean;
  lastPollAttempt?: GatewayPollLastAttempt | null;
  workerLastOkAt?: string | null;
  workerLastError?: string | null;
};

export type GatewayPollBatchSnapshot = {
  tickAt: number;
  limit: number;
  slowRunningTotal: number;
  selectedSlowIds: string[];
  selectedNormalIds: string[];
  tickDbErrors: string[];
  workerOk: boolean;
};

const GATEWAY_POLL_PROVIDER_KINDS = [
  "KIE",
  "BAILIAN",
  "DASHSCOPE",
  "HUNYUAN",
  "VOLCENGINE",
] as const;

const WORKER_STALE_MS = VOLCENGINE_GATEWAY_POLL_GAP_MS * 2;
const AUDIT_LAG_MS = VOLCENGINE_GATEWAY_POLL_GAP_MS;
const AUDIT_TAKE = 8;

let lastWorkerOkAt = 0;
let lastWorkerError: string | null = null;

export function markGatewayPollWorkerTick(ok: boolean, error?: string): void {
  if (ok) {
    lastWorkerOkAt = Date.now();
    lastWorkerError = null;
    return;
  }
  lastWorkerError = error?.slice(0, 300) ?? "tick_failed";
}

export function readGatewayPollWorkerHeartbeat(): {
  lastOkAt: number;
  lastError: string | null;
} {
  return { lastOkAt: lastWorkerOkAt, lastError: lastWorkerError };
}

function readGatewayMeta(resultSummary: unknown): Record<string, unknown> | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const gw = (resultSummary as Record<string, unknown>)._gateway;
  if (!gw || typeof gw !== "object") return null;
  return gw as Record<string, unknown>;
}

export function readPollLastAttempt(
  resultSummary: unknown,
): GatewayPollLastAttempt | null {
  const gw = readGatewayMeta(resultSummary);
  const raw = gw?.lastPollAttempt;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const at = typeof o.at === "string" ? o.at : null;
  if (!at) return null;
  return {
    at,
    ok: o.ok === true,
    kind: o.kind === "db" ? "db" : "vendor",
    error: typeof o.error === "string" ? o.error.slice(0, 500) : undefined,
  };
}

export function readPollStallDiagnostic(
  resultSummary: unknown,
): GatewayPollStallDiagnostic | null {
  const gw = readGatewayMeta(resultSummary);
  const raw = gw?.pollStallDiagnostic;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== "gateway_poll_stall") return null;
  const cause = o.cause;
  if (typeof cause !== "string") return null;
  return raw as GatewayPollStallDiagnostic;
}

function mergeGatewayMeta(
  resultSummary: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    resultSummary && typeof resultSummary === "object" && !Array.isArray(resultSummary)
      ? ({ ...(resultSummary as Record<string, unknown>) } as Record<string, unknown>)
      : resultSummary != null
        ? { value: resultSummary }
        : {};
  const prevGw =
    base._gateway && typeof base._gateway === "object"
      ? { ...(base._gateway as Record<string, unknown>) }
      : {};
  base._gateway = { ...prevGw, ...patch };
  return base as Prisma.InputJsonValue;
}

export async function recordGatewayPollLastAttempt(input: {
  logId: string;
  resultSummary: unknown;
  ok: boolean;
  kind: GatewayPollLastAttempt["kind"];
  error?: string;
}): Promise<void> {
  const attempt: GatewayPollLastAttempt = {
    at: new Date().toISOString(),
    ok: input.ok,
    kind: input.kind,
    error: input.error?.slice(0, 500),
  };
  try {
    await prisma.gatewayRequestLog.updateMany({
      where: {
        id: input.logId,
        status: { in: ["PENDING", "RUNNING"] },
      },
      data: {
        resultSummary: mergeGatewayMeta(input.resultSummary, {
          lastPollAttempt: attempt,
        }),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/connection pool|timed out fetching/i.test(msg)) {
      markGatewayPollWorkerTick(false, msg);
    }
  }
}

export async function persistPollStallDiagnostic(
  logId: string,
  resultSummary: unknown,
  diagnostic: GatewayPollStallDiagnostic,
): Promise<void> {
  await prisma.gatewayRequestLog.updateMany({
    where: {
      id: logId,
      status: { in: ["PENDING", "RUNNING"] },
    },
    data: {
      resultSummary: mergeGatewayMeta(resultSummary, {
        pollStallDiagnostic: diagnostic,
      }),
    },
  });
}

function stallHint(cause: GatewayPollStallCause, extra?: string): string {
  switch (cause) {
    case "batch_starved_slow_queue":
      return (
        "本轮 poll worker 慢任务通道已满（默认每轮 20 条），该任务排在更后尚未被选中。" +
        "若全局 RUNNING 很多，Poll Δ 会持续增长；可开轮询池页或加大 GENERATION_POLL_BATCH。" +
        (extra ? ` ${extra}` : "")
      );
    case "batch_starved_normal_queue":
      return (
        "任务仍在正常通道排队，本轮未进入 poll batch。" +
        "确认 gateway-poll-loop 是否在跑。" +
        (extra ? ` ${extra}` : "")
      );
    case "poll_loop_tick_failed":
      return (
        "gateway poll worker 最近 tick 失败（常见：DB connection pool timeout）。" +
        "请查 [mall]/[gateway-poll] 日志并重启 dev:all。" +
        (extra ? ` ${extra}` : "")
      );
    case "poll_vendor_timeout":
      return (
        "最近一次 recordInfo 超时；lastPolledAt 仍会更新，但若连续失败 Poll Δ 仍偏大。" +
        (extra ? ` ${extra}` : "")
      );
    case "poll_db_error":
      return (
        "最近一次 poll 写库失败（connection pool / Server closed connection）。" +
        (extra ? ` ${extra}` : "")
      );
    case "poll_worker_stale":
      return (
        "长时间未见 gateway poll worker 成功 tick（gateway-poll-loop 未启动或进程挂掉）。" +
        (extra ? ` ${extra}` : "")
      );
    default:
      return extra ?? "Poll Δ 超过轮询间隔阈值，原因未明；可 GET /api/gateway/logs/:id/poll-diagnostic 复查。";
  }
}

function classifyLastAttempt(
  attempt: GatewayPollLastAttempt | null,
): GatewayPollStallCause | null {
  if (!attempt || attempt.ok) return null;
  const err = attempt.error ?? "";
  if (/connection pool|timed out fetching|Server has closed the connection/i.test(err)) {
    return "poll_db_error";
  }
  if (/timeout|recordInfo/i.test(err)) {
    return "poll_vendor_timeout";
  }
  return null;
}

export async function diagnoseGatewayPollStall(
  logId: string,
  batch?: GatewayPollBatchSnapshot,
): Promise<GatewayPollStallDiagnostic | null> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      status: true,
      providerKind: true,
      requestKind: true,
      submittedAt: true,
      lastPolledAt: true,
      resultSummary: true,
      externalTaskId: true,
    },
  });
  if (!log) return null;
  if (log.status !== "RUNNING" && log.status !== "PENDING") return null;
  if (!log.externalTaskId?.trim()) return null;

  const now = Date.now();
  const trace = readVolcengineTimingTrace(log.resultSummary);
  const lastPollMs =
    trace?.lastPolledAtMs ??
    log.lastPolledAt?.getTime() ??
    log.submittedAt.getTime();
  const pollLagMs = Math.max(0, now - lastPollMs);
  if (pollLagMs < AUDIT_LAG_MS) return null;

  const lastAttempt = readPollLastAttempt(log.resultSummary);
  const heartbeat = readGatewayPollWorkerHeartbeat();

  let cause: GatewayPollStallCause = "unknown";
  const selectedThisTick = batch
    ? batch.selectedSlowIds.includes(logId) ||
      batch.selectedNormalIds.includes(logId)
    : undefined;

  if (batch && !batch.workerOk) {
    cause = "poll_loop_tick_failed";
  } else if (
    heartbeat.lastOkAt > 0 &&
    now - heartbeat.lastOkAt > WORKER_STALE_MS
  ) {
    cause = "poll_worker_stale";
  } else if (batch && selectedThisTick === false) {
    const slowCutoff = batch.tickAt - 800_000;
    const isSlow = log.submittedAt.getTime() <= slowCutoff;
    if (isSlow && batch.slowRunningTotal > batch.limit) {
      cause = "batch_starved_slow_queue";
    } else {
      cause = "batch_starved_normal_queue";
    }
  } else {
    cause = classifyLastAttempt(lastAttempt) ?? "unknown";
  }

  if (
    cause === "unknown" &&
    batch?.tickDbErrors.some((e) => /connection pool|timed out fetching/i.test(e))
  ) {
    cause = "poll_loop_tick_failed";
  }

  const extra =
    lastAttempt?.error ??
    batch?.tickDbErrors[0] ??
    heartbeat.lastError ??
    undefined;

  return {
    kind: "gateway_poll_stall",
    checkedAt: new Date(now).toISOString(),
    pollLagMs,
    pollLagSec: Math.round(pollLagMs / 1000),
    cause,
    hint: stallHint(cause, extra),
    batchLimit: batch?.limit,
    slowRunningTotal: batch?.slowRunningTotal,
    selectedThisTick,
    lastPollAttempt: lastAttempt,
    workerLastOkAt:
      heartbeat.lastOkAt > 0
        ? new Date(heartbeat.lastOkAt).toISOString()
        : null,
    workerLastError: heartbeat.lastError,
  };
}

const slowRunningWhere = (slowCutoff: Date): Prisma.GatewayRequestLogWhereInput => ({
  status: "RUNNING",
  externalTaskId: { not: null },
  submittedAt: { lte: slowCutoff },
  providerKind: { in: [...GATEWAY_POLL_PROVIDER_KINDS] },
});

/** poll worker 每轮结束后：对 Poll Δ 过大的 RUNNING 任务写入诊断并打日志 */
export async function auditGatewayPollStallAfterBatch(
  batch: GatewayPollBatchSnapshot,
): Promise<{ audited: number; worstLagSec: number }> {
  const now = batch.tickAt;
  const lagCutoff = new Date(now - AUDIT_LAG_MS);

  const candidates = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      externalTaskId: { not: null },
      providerKind: { in: [...GATEWAY_POLL_PROVIDER_KINDS] },
      OR: [
        { lastPolledAt: { lte: lagCutoff } },
        { lastPolledAt: null, submittedAt: { lte: lagCutoff } },
      ],
    },
    orderBy: [{ lastPolledAt: "asc" }, { submittedAt: "asc" }],
    take: AUDIT_TAKE,
    select: {
      id: true,
      resultSummary: true,
    },
  });

  let worstLagSec = 0;
  let audited = 0;

  for (const row of candidates) {
    const diag = await diagnoseGatewayPollStall(row.id, batch);
    if (!diag) continue;
    worstLagSec = Math.max(worstLagSec, diag.pollLagSec);
    await persistPollStallDiagnostic(row.id, row.resultSummary, diag).catch(
      () => undefined,
    );
    audited += 1;
    console.warn("[gateway-poll] stall-diagnostic", {
      logId: row.id,
      pollLagSec: diag.pollLagSec,
      cause: diag.cause,
      selectedThisTick: diag.selectedThisTick,
      slowRunningTotal: diag.slowRunningTotal,
      batchLimit: diag.batchLimit,
    });
  }

  return { audited, worstLagSec };
}

export async function countSlowRunningGatewayLogs(
  slowCutoff: Date,
): Promise<number> {
  return prisma.gatewayRequestLog.count({
    where: slowRunningWhere(slowCutoff),
  });
}

export { slowRunningWhere, GATEWAY_POLL_PROVIDER_KINDS };
