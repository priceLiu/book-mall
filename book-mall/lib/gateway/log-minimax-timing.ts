/**
 * Gateway 日志 · MiniMax H3 视频耗时拆分
 *
 * 厂商 poll 回包 task 含 created_at / updated_at（Unix 秒）：
 * - 排队：Gateway submittedAt → created_at
 * - 生成：created_at → updated_at
 * - 轮询：updated_at → Gateway completedAt（或首次 poll 到 succeeded）
 */

import type { MinimaxVideoTaskRow } from "@/lib/gateway/minimax-video-client";

export type { MinimaxVideoTaskRow };
import {
  GATEWAY_POLL_DELAY_LIMIT_MS,
  type VolcengineTimingBreakdown,
} from "@/lib/gateway/log-volcengine-timing";

export type MinimaxTimingTrace = {
  kind: "minimax_timing";
  vendorCreatedAtMs?: number;
  vendorUpdatedAtMs?: number;
  firstQueuedAtMs?: number;
  firstRunningAtMs?: number;
  firstSucceededPolledAtMs?: number;
  firstFailedPolledAtMs?: number;
  lastStatus?: string;
  lastPolledAtMs?: number;
  peakPollDelayMs?: number;
};

export type MinimaxTimingBreakdown = VolcengineTimingBreakdown;

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function isSuccessStatus(status: string): boolean {
  return status === "succeeded" || status === "success";
}

function isFailedStatus(status: string): boolean {
  return status === "failed" || status === "cancelled" || status === "canceled";
}

/** MiniMax API 返回 Unix 秒；若已是毫秒则原样使用 */
export function parseMinimaxUnixMs(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return undefined;
  return raw >= 1e12 ? Math.trunc(raw) : Math.trunc(raw * 1000);
}

export function isMinimaxPhaseTimingLog(input: {
  providerKind: string | null;
  requestKind: string;
}): boolean {
  return input.providerKind === "MINIMAX" && input.requestKind === "VIDEO";
}

export function readMinimaxTimingTrace(
  resultSummary: unknown,
): MinimaxTimingTrace | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  const gateway = root._gateway;
  if (gateway && typeof gateway === "object") {
    const trace = (gateway as Record<string, unknown>).minimaxTiming;
    if (trace && typeof trace === "object") {
      return trace as MinimaxTimingTrace;
    }
  }
  const direct = root.minimaxTiming;
  if (direct && typeof direct === "object") {
    return direct as MinimaxTimingTrace;
  }
  return null;
}

export function readMinimaxTimingBreakdown(
  resultSummary: unknown,
): MinimaxTimingBreakdown | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  const gateway = root._gateway;
  if (gateway && typeof gateway === "object") {
    const breakdown = (gateway as Record<string, unknown>).timingBreakdown;
    if (breakdown && typeof breakdown === "object") {
      return breakdown as MinimaxTimingBreakdown;
    }
  }
  return null;
}

function readMinimaxTaskFromSummary(
  resultSummary: unknown,
): MinimaxVideoTaskRow | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  const task = root.task;
  if (task && typeof task === "object") {
    return task as MinimaxVideoTaskRow;
  }
  return null;
}

/** 终态日志无 trace 时，从 resultSummary.task 反推（修复历史 MiniMax 日志分列空白） */
export function synthesizeMinimaxTimingTraceFromSummary(input: {
  resultSummary: unknown;
  submittedAtMs: number;
  completedAtMs?: number | null;
}): MinimaxTimingTrace | null {
  const task = readMinimaxTaskFromSummary(input.resultSummary);
  if (!task) return null;
  const status = normalizeStatus(task.status);
  const created = parseMinimaxUnixMs(task.created_at);
  const updated = parseMinimaxUnixMs(task.updated_at);
  if (created == null && updated == null && !status) return null;

  const trace: MinimaxTimingTrace = {
    kind: "minimax_timing",
    vendorCreatedAtMs: created,
    vendorUpdatedAtMs: updated,
    lastStatus: status || undefined,
  };

  if (status === "queued") {
    trace.firstQueuedAtMs = created ?? input.submittedAtMs;
  }
  if (status === "running") {
    trace.firstRunningAtMs = created ?? updated ?? input.submittedAtMs;
  }
  if (isSuccessStatus(status)) {
    trace.firstSucceededPolledAtMs =
      input.completedAtMs ?? updated ?? created ?? undefined;
    trace.lastPolledAtMs = input.completedAtMs ?? updated ?? undefined;
  }
  if (isFailedStatus(status)) {
    trace.firstFailedPolledAtMs =
      input.completedAtMs ?? updated ?? created ?? undefined;
    trace.lastPolledAtMs = input.completedAtMs ?? updated ?? undefined;
  }

  return trace;
}

export function mergeMinimaxTimingTrace(
  existing: MinimaxTimingTrace | null,
  input: {
    status: string;
    task: MinimaxVideoTaskRow;
    polledAtMs?: number;
  },
): MinimaxTimingTrace {
  const now = input.polledAtMs ?? Date.now();
  const status = normalizeStatus(input.status);
  const created = parseMinimaxUnixMs(input.task.created_at);
  const updated = parseMinimaxUnixMs(input.task.updated_at);

  const trace: MinimaxTimingTrace = {
    kind: "minimax_timing",
    ...existing,
    lastStatus: status,
    lastPolledAtMs: now,
  };

  if (created != null) {
    trace.vendorCreatedAtMs = trace.vendorCreatedAtMs ?? created;
  }
  if (updated != null) {
    trace.vendorUpdatedAtMs = updated;
  }

  if (status === "queued") {
    trace.firstQueuedAtMs = trace.firstQueuedAtMs ?? created ?? now;
  }
  if (status === "running") {
    trace.firstRunningAtMs =
      trace.firstRunningAtMs ?? created ?? updated ?? now;
  }
  if (isSuccessStatus(status)) {
    trace.firstSucceededPolledAtMs = trace.firstSucceededPolledAtMs ?? now;
  }
  if (isFailedStatus(status)) {
    trace.firstFailedPolledAtMs = trace.firstFailedPolledAtMs ?? now;
  }

  return trace;
}

export function computeMinimaxTimingBreakdown(input: {
  trace: MinimaxTimingTrace;
  submittedAtMs: number;
  completedAtMs?: number | null;
  nowMs?: number;
}): MinimaxTimingBreakdown {
  const now = input.nowMs ?? Date.now();
  const completedAtMs = input.completedAtMs ?? null;
  const pollLimit = GATEWAY_POLL_DELAY_LIMIT_MS;
  const { trace } = input;

  const genStart =
    trace.vendorCreatedAtMs ??
    trace.firstRunningAtMs ??
    trace.firstQueuedAtMs ??
    null;

  let queueMs: number | null = null;
  if (genStart != null) {
    queueMs = Math.max(0, genStart - input.submittedAtMs);
  } else if (completedAtMs == null) {
    queueMs = Math.max(0, now - input.submittedAtMs);
  }

  let generateMs: number | null = null;
  let vendorPostProcessMs: number | null = null;
  let pollDelayMs: number | null = null;

  const created = trace.vendorCreatedAtMs;
  const updated = trace.vendorUpdatedAtMs;

  if (created != null && updated != null && updated > created) {
    generateMs = Math.max(0, updated - created);
  } else if (genStart != null && completedAtMs == null) {
    generateMs = Math.max(0, now - genStart);
  } else if (genStart != null && completedAtMs != null) {
    generateMs = Math.max(0, completedAtMs - genStart);
  }

  if (completedAtMs != null) {
    const vendorEnd =
      updated ??
      trace.firstSucceededPolledAtMs ??
      trace.firstFailedPolledAtMs ??
      null;
    if (vendorEnd != null) {
      pollDelayMs = Math.max(0, completedAtMs - vendorEnd);
    }
  } else if (trace.lastPolledAtMs != null) {
    pollDelayMs = Math.max(0, now - trace.lastPolledAtMs);
  }

  return {
    queueMs,
    generateMs,
    vendorPostProcessMs,
    pollDelayMs,
    peakPollDelayMs: trace.peakPollDelayMs ?? null,
    pollDelayOverLimit: pollDelayMs != null && pollDelayMs > pollLimit,
  };
}

export function bumpMinimaxPeakPollDelay(
  trace: MinimaxTimingTrace,
  pollDelayMs: number | null | undefined,
): MinimaxTimingTrace {
  if (pollDelayMs == null || pollDelayMs <= 0) return trace;
  const prev = trace.peakPollDelayMs ?? 0;
  if (pollDelayMs <= prev) return trace;
  return { ...trace, peakPollDelayMs: pollDelayMs };
}

/** 轮询回包写入 task / 厂商 raw，保留已有 _gateway trace */
export function mergeMinimaxVendorSnapshot(
  existing: unknown,
  raw: unknown,
  task: MinimaxVideoTaskRow,
): Record<string, unknown> {
  const snap: Record<string, unknown> =
    raw != null && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (!snap.task) snap.task = task;

  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    const prev = existing as Record<string, unknown>;
    const gateway = prev._gateway;
    const merged = { ...prev, ...snap };
    if (gateway && typeof gateway === "object") {
      merged._gateway = gateway;
    }
    return merged;
  }
  return snap;
}

export function attachMinimaxTimingToSummary(
  existing: unknown,
  trace: MinimaxTimingTrace,
  breakdown: MinimaxTimingBreakdown,
  rawOverride?: unknown,
): Record<string, unknown> {
  const base =
    rawOverride != null
      ? rawOverride
      : existing && typeof existing === "object" && !Array.isArray(existing)
        ? existing
        : existing != null
          ? { value: existing }
          : {};
  const obj =
    base && typeof base === "object" && !Array.isArray(base)
      ? ({ ...(base as Record<string, unknown>) } as Record<string, unknown>)
      : ({ value: base } as Record<string, unknown>);

  const prevGateway =
    obj._gateway && typeof obj._gateway === "object"
      ? (obj._gateway as Record<string, unknown>)
      : {};
  obj._gateway = {
    ...prevGateway,
    minimaxTiming: trace,
    timingBreakdown: breakdown,
  };
  return obj;
}

export function buildMinimaxTerminalFinalizeMetrics(input: {
  trace: MinimaxTimingTrace;
  status: "SUCCEEDED" | "FAILED";
  submittedAt: Date;
  resultSummaryBase: unknown;
  fallbackNowMs?: number;
}): {
  completedAtMs: number;
  durationMs: number;
  breakdown: MinimaxTimingBreakdown;
  resultSummary: Record<string, unknown>;
  vendorDurationMs: number | null;
} {
  const submittedAtMs = input.submittedAt.getTime();
  const fallbackNowMs = input.fallbackNowMs ?? Date.now();
  const { trace, status } = input;

  let completedAtMs = fallbackNowMs;
  if (status === "SUCCEEDED") {
    completedAtMs =
      trace.firstSucceededPolledAtMs ??
      trace.vendorUpdatedAtMs ??
      trace.vendorCreatedAtMs ??
      fallbackNowMs;
  } else {
    completedAtMs =
      trace.firstFailedPolledAtMs ??
      trace.vendorUpdatedAtMs ??
      fallbackNowMs;
  }
  completedAtMs = Math.max(completedAtMs, submittedAtMs);

  const breakdown = computeMinimaxTimingBreakdown({
    trace,
    submittedAtMs,
    completedAtMs,
  });

  const parts = [
    breakdown.queueMs,
    breakdown.generateMs,
    breakdown.vendorPostProcessMs,
    breakdown.pollDelayMs,
  ];
  let durationMs = 0;
  for (const part of parts) {
    if (part != null && part > 0) durationMs += part;
  }
  if (durationMs <= 0) {
    durationMs = Math.max(0, completedAtMs - submittedAtMs);
  }

  const vendorDurationMs =
    trace.vendorCreatedAtMs != null && trace.vendorUpdatedAtMs != null
      ? Math.max(0, trace.vendorUpdatedAtMs - trace.vendorCreatedAtMs)
      : breakdown.generateMs;

  const resultSummary = attachMinimaxTimingToSummary(
    input.resultSummaryBase,
    trace,
    breakdown,
  );

  return {
    completedAtMs,
    durationMs,
    breakdown,
    resultSummary,
    vendorDurationMs,
  };
}

export function resolveMinimaxLogTiming(input: {
  providerKind: string | null;
  requestKind: string;
  submittedAt: Date;
  completedAt: Date | null;
  resultSummary: unknown;
  nowMs?: number;
}): MinimaxTimingBreakdown | null {
  if (!isMinimaxPhaseTimingLog(input)) return null;

  const stored = readMinimaxTimingBreakdown(input.resultSummary);
  let trace = readMinimaxTimingTrace(input.resultSummary);
  if (!trace) {
    trace = synthesizeMinimaxTimingTraceFromSummary({
      resultSummary: input.resultSummary,
      submittedAtMs: input.submittedAt.getTime(),
      completedAtMs: input.completedAt?.getTime() ?? null,
    });
  }
  if (!trace) return stored;

  if (input.completedAt != null && stored) {
    return stored;
  }

  return computeMinimaxTimingBreakdown({
    trace,
    submittedAtMs: input.submittedAt.getTime(),
    completedAtMs: input.completedAt?.getTime() ?? null,
    nowMs: input.nowMs,
  });
}

export function resolveMinimaxVendorNativeTimingForLogRow(input: {
  providerKind: string | null;
  requestKind: string;
  resultSummary: unknown;
}): {
  vendorNativeDurationMs: number | null;
  vendorNativeGenerateMs: number | null;
} {
  if (!isMinimaxPhaseTimingLog(input)) {
    return { vendorNativeDurationMs: null, vendorNativeGenerateMs: null };
  }
  let trace = readMinimaxTimingTrace(input.resultSummary);
  if (!trace) {
    trace = synthesizeMinimaxTimingTraceFromSummary({
      resultSummary: input.resultSummary,
      submittedAtMs: Date.now(),
    });
  }
  if (!trace?.vendorCreatedAtMs || !trace.vendorUpdatedAtMs) {
    return { vendorNativeDurationMs: null, vendorNativeGenerateMs: null };
  }
  const span = Math.max(0, trace.vendorUpdatedAtMs - trace.vendorCreatedAtMs);
  return {
    vendorNativeDurationMs: span,
    vendorNativeGenerateMs: span,
  };
}
