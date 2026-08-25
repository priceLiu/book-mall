/**
 * Gateway 日志 · 百炼 / DashScope 异步任务耗时拆分
 *
 * 厂商 poll 回包 output 含 submit_time / scheduled_time / end_time：
 * - 排队：Gateway submittedAt → scheduled_time（无则 submit_time）
 * - 生成：scheduled_time → end_time（进行中无 end_time 时按墙钟累计）
 * - 后处理：—（DashScope 以 end_time 为终态，无 Seedance 式 status 滞后）
 * - 轮询：end_time / 首次 succeeded 观测 → Gateway completedAt
 */

import {
  parseDashscopeDatetimeMs,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import {
  GATEWAY_POLL_DELAY_LIMIT_MS,
  type VolcengineTimingBreakdown,
} from "@/lib/gateway/log-volcengine-timing";

export type DashscopeTimingTrace = {
  kind: "dashscope_timing";
  vendorSubmitAtMs?: number;
  vendorScheduledAtMs?: number;
  vendorEndAtMs?: number;
  firstRunningAtMs?: number;
  firstSucceededPolledAtMs?: number;
  firstFailedPolledAtMs?: number;
  lastStatus?: string;
  lastPolledAtMs?: number;
  peakPollDelayMs?: number;
};

export type DashscopeTimingBreakdown = VolcengineTimingBreakdown;

const DASHSCOPE_PHASE_PROVIDERS = new Set(["DASHSCOPE", "BAILIAN"]);

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function isTerminalStatus(status: string): boolean {
  return (
    status === "succeeded" ||
    status === "success" ||
    status === "failed" ||
    status === "canceled" ||
    status === "cancelled" ||
    status === "unknown"
  );
}

function isSuccessStatus(status: string): boolean {
  return status === "succeeded" || status === "success";
}

function isFailedStatus(status: string): boolean {
  return (
    status === "failed" ||
    status === "canceled" ||
    status === "cancelled" ||
    status === "unknown"
  );
}

export function isDashscopePhaseTimingLog(input: {
  providerKind: string | null;
  requestKind: string;
}): boolean {
  if (!input.providerKind || !DASHSCOPE_PHASE_PROVIDERS.has(input.providerKind)) {
    return false;
  }
  return input.requestKind !== "CHAT";
}

export function readDashscopeTimingFields(
  output: DashscopeTaskOutput | Record<string, unknown>,
): {
  submitAtMs?: number;
  scheduledAtMs?: number;
  endAtMs?: number;
} {
  const row = output as Record<string, unknown>;
  return {
    submitAtMs: parseDashscopeDatetimeMs(row.submit_time),
    scheduledAtMs: parseDashscopeDatetimeMs(row.scheduled_time),
    endAtMs: parseDashscopeDatetimeMs(row.end_time),
  };
}

export function readDashscopeTimingTrace(
  resultSummary: unknown,
): DashscopeTimingTrace | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  const gateway = root._gateway;
  if (gateway && typeof gateway === "object") {
    const trace = (gateway as Record<string, unknown>).dashscopeTiming;
    if (trace && typeof trace === "object") {
      return trace as DashscopeTimingTrace;
    }
  }
  const direct = root.dashscopeTiming;
  if (direct && typeof direct === "object") {
    return direct as DashscopeTimingTrace;
  }
  return null;
}

export function readDashscopeTimingBreakdown(
  resultSummary: unknown,
): DashscopeTimingBreakdown | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  const gateway = root._gateway;
  if (gateway && typeof gateway === "object") {
    const breakdown = (gateway as Record<string, unknown>).timingBreakdown;
    if (breakdown && typeof breakdown === "object") {
      return breakdown as DashscopeTimingBreakdown;
    }
  }
  return null;
}

export function mergeDashscopeTimingTrace(
  existing: DashscopeTimingTrace | null,
  input: {
    status: string;
    output: DashscopeTaskOutput | Record<string, unknown>;
    polledAtMs?: number;
  },
): DashscopeTimingTrace {
  const now = input.polledAtMs ?? Date.now();
  const status = normalizeStatus(input.status);
  const { submitAtMs, scheduledAtMs, endAtMs } = readDashscopeTimingFields(
    input.output,
  );

  const trace: DashscopeTimingTrace = {
    kind: "dashscope_timing",
    ...existing,
    lastStatus: status,
    lastPolledAtMs: now,
  };

  if (submitAtMs != null) {
    trace.vendorSubmitAtMs = trace.vendorSubmitAtMs ?? submitAtMs;
  }
  if (scheduledAtMs != null) {
    trace.vendorScheduledAtMs = trace.vendorScheduledAtMs ?? scheduledAtMs;
  }
  if (endAtMs != null) {
    trace.vendorEndAtMs = endAtMs;
  }

  if (
    status === "running" ||
    status === "processing" ||
    status === "pending"
  ) {
    if (trace.firstRunningAtMs == null) {
      trace.firstRunningAtMs = scheduledAtMs ?? submitAtMs ?? now;
    }
  }

  if (isSuccessStatus(status)) {
    if (trace.firstSucceededPolledAtMs == null) {
      trace.firstSucceededPolledAtMs = now;
    }
    if (endAtMs != null) trace.vendorEndAtMs = endAtMs;
  }

  if (isFailedStatus(status)) {
    if (trace.firstFailedPolledAtMs == null) {
      trace.firstFailedPolledAtMs = now;
    }
  }

  return trace;
}

export function dashscopeTimingGenStartMs(
  trace: DashscopeTimingTrace,
): number | null {
  return (
    trace.vendorScheduledAtMs ??
    trace.vendorSubmitAtMs ??
    trace.firstRunningAtMs ??
    null
  );
}

export function dashscopeVendorGenerateMs(
  trace: DashscopeTimingTrace,
): number | null {
  const genStart = dashscopeTimingGenStartMs(trace);
  const end = trace.vendorEndAtMs;
  if (genStart == null || end == null) return null;
  return Math.max(0, end - genStart);
}

export function computeDashscopeTimingBreakdown(input: {
  trace: DashscopeTimingTrace;
  submittedAtMs: number;
  completedAtMs: number | null;
  nowMs?: number;
}): DashscopeTimingBreakdown {
  const now = input.nowMs ?? Date.now();
  const trace = input.trace;
  const isTerminal = input.completedAtMs != null;
  const genStart = dashscopeTimingGenStartMs(trace);
  const endAt = trace.vendorEndAtMs;

  let queueMs: number | null = null;
  if (genStart != null) {
    queueMs = Math.max(0, genStart - input.submittedAtMs);
  } else if (!isTerminal) {
    queueMs = Math.max(0, now - input.submittedAtMs);
  }

  let generateMs: number | null = null;
  let vendorPostProcessMs: number | null = null;
  let pollDelayMs: number | null = null;

  if (!isTerminal) {
    pollDelayMs =
      trace.lastPolledAtMs != null
        ? Math.max(0, now - trace.lastPolledAtMs)
        : 0;
    const gpuMs = dashscopeVendorGenerateMs(trace);
    if (gpuMs != null) {
      generateMs = gpuMs;
    } else if (genStart != null) {
      const st = normalizeStatus(trace.lastStatus);
      if (
        st === "running" ||
        st === "processing" ||
        st === "pending" ||
        trace.firstRunningAtMs != null
      ) {
        generateMs = Math.max(0, now - genStart);
      }
    }
  } else if (input.completedAtMs != null) {
    const completedAtMs = input.completedAtMs;
    if (genStart != null && endAt != null) {
      generateMs = Math.max(0, endAt - genStart);
      const firstSucc =
        trace.firstSucceededPolledAtMs ??
        (isSuccessStatus(normalizeStatus(trace.lastStatus))
          ? trace.lastPolledAtMs
          : null);
      const vendorDone = endAt;
      const pollAnchor = firstSucc != null ? Math.max(firstSucc, vendorDone) : vendorDone;
      pollDelayMs = Math.max(0, completedAtMs - pollAnchor);
    } else if (genStart != null) {
      const vendorFailedAt = trace.firstFailedPolledAtMs ?? trace.lastPolledAtMs;
      if (vendorFailedAt != null) {
        generateMs = Math.max(0, vendorFailedAt - genStart);
        pollDelayMs = Math.max(0, completedAtMs - vendorFailedAt);
      } else {
        generateMs = Math.max(0, completedAtMs - genStart);
      }
    }
  }

  const pollLimit = isTerminal
    ? GATEWAY_POLL_DELAY_LIMIT_MS
    : 2 * 60 * 1000;

  return {
    queueMs,
    generateMs,
    vendorPostProcessMs,
    pollDelayMs,
    peakPollDelayMs: trace.peakPollDelayMs ?? null,
    pollDelayOverLimit: pollDelayMs != null && pollDelayMs > pollLimit,
  };
}

export function bumpDashscopePeakPollDelay(
  trace: DashscopeTimingTrace,
  pollDelayMs: number | null | undefined,
): DashscopeTimingTrace {
  if (pollDelayMs == null || pollDelayMs <= 0) return trace;
  const prev = trace.peakPollDelayMs ?? 0;
  if (pollDelayMs <= prev) return trace;
  return { ...trace, peakPollDelayMs: pollDelayMs };
}

export function attachDashscopeTimingToSummary(
  existing: unknown,
  trace: DashscopeTimingTrace,
  breakdown: DashscopeTimingBreakdown,
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

  obj._gateway = {
    dashscopeTiming: trace,
    timingBreakdown: breakdown,
  };
  return obj;
}

export function resolveDashscopeTerminalCompletedAtMs(input: {
  trace: DashscopeTimingTrace;
  status: "SUCCEEDED" | "FAILED";
  submittedAtMs: number;
  fallbackNowMs?: number;
}): number {
  const fallbackNowMs = input.fallbackNowMs ?? Date.now();
  const { trace, status, submittedAtMs } = input;

  if (status === "SUCCEEDED") {
    if (trace.firstSucceededPolledAtMs != null) {
      return Math.max(trace.firstSucceededPolledAtMs, submittedAtMs);
    }
    if (trace.vendorEndAtMs != null) {
      return Math.max(trace.vendorEndAtMs, submittedAtMs);
    }
    return fallbackNowMs;
  }

  if (trace.firstFailedPolledAtMs != null) {
    return Math.max(trace.firstFailedPolledAtMs, submittedAtMs);
  }
  if (trace.vendorEndAtMs != null) {
    return Math.max(trace.vendorEndAtMs, submittedAtMs);
  }
  return fallbackNowMs;
}

export function sumDashscopeTimingBreakdownMs(input: {
  breakdown: DashscopeTimingBreakdown;
  submittedAtMs: number;
  completedAtMs: number;
}): number {
  const parts = [
    input.breakdown.queueMs,
    input.breakdown.generateMs,
    input.breakdown.vendorPostProcessMs,
    input.breakdown.pollDelayMs,
  ];
  let sum = 0;
  for (const part of parts) {
    if (part != null && part > 0) sum += part;
  }
  if (sum > 0) return sum;
  return Math.max(0, input.completedAtMs - input.submittedAtMs);
}

export function buildDashscopeTerminalFinalizeMetrics(input: {
  trace: DashscopeTimingTrace;
  status: "SUCCEEDED" | "FAILED";
  submittedAt: Date;
  resultSummaryBase: unknown;
  fallbackNowMs?: number;
}): {
  completedAtMs: number;
  durationMs: number;
  breakdown: DashscopeTimingBreakdown;
  resultSummary: Record<string, unknown>;
} {
  const submittedAtMs = input.submittedAt.getTime();
  const fallbackNowMs = input.fallbackNowMs ?? Date.now();
  const completedAtMs = resolveDashscopeTerminalCompletedAtMs({
    trace: input.trace,
    status: input.status,
    submittedAtMs,
    fallbackNowMs,
  });
  const breakdown = computeDashscopeTimingBreakdown({
    trace: input.trace,
    submittedAtMs,
    completedAtMs,
  });
  const durationMs = sumDashscopeTimingBreakdownMs({
    breakdown,
    submittedAtMs,
    completedAtMs,
  });
  const resultSummary = attachDashscopeTimingToSummary(
    input.resultSummaryBase,
    input.trace,
    breakdown,
  );
  return { completedAtMs, durationMs, breakdown, resultSummary };
}

export function resolveDashscopeLogTiming(input: {
  providerKind: string | null;
  requestKind: string;
  submittedAt: Date;
  completedAt: Date | null;
  resultSummary: unknown;
  nowMs?: number;
}): DashscopeTimingBreakdown | null {
  if (!isDashscopePhaseTimingLog(input)) return null;

  const stored = readDashscopeTimingBreakdown(input.resultSummary);
  const trace = readDashscopeTimingTrace(input.resultSummary);
  if (!trace) return stored;

  if (input.completedAt != null && stored) {
    return stored;
  }

  return computeDashscopeTimingBreakdown({
    trace,
    submittedAtMs: input.submittedAt.getTime(),
    completedAtMs: input.completedAt?.getTime() ?? null,
    nowMs: input.nowMs,
  });
}

export function resolveDashscopeVendorNativeTimingForLogRow(input: {
  providerKind: string | null;
  requestKind: string;
  resultSummary: unknown;
}): {
  vendorNativeDurationMs: number | null;
  vendorNativeGenerateMs: number | null;
} {
  if (!isDashscopePhaseTimingLog(input)) {
    return { vendorNativeDurationMs: null, vendorNativeGenerateMs: null };
  }
  const trace = readDashscopeTimingTrace(input.resultSummary);
  if (!trace) {
    return { vendorNativeDurationMs: null, vendorNativeGenerateMs: null };
  }
  const generateMs = dashscopeVendorGenerateMs(trace);
  let durationMs: number | null = null;
  if (trace.vendorSubmitAtMs != null && trace.vendorEndAtMs != null) {
    durationMs = Math.max(0, trace.vendorEndAtMs - trace.vendorSubmitAtMs);
  }
  return {
    vendorNativeDurationMs: durationMs ?? generateMs,
    vendorNativeGenerateMs: generateMs,
  };
}
