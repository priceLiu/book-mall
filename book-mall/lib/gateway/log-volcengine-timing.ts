/**
 * Gateway 日志 · 火山视频任务耗时拆分（排队 / 生成 / 轮询延迟）
 *
 * - 排队：Gateway submittedAt → 首次观测到 running（或进行中 queued 段）
 * - 生成：首次 running → 厂商 updated_at（成功）或当前时刻（进行中）
 * - 轮询延迟：厂商 updated_at → Gateway completedAt（应 ≤10s）
 */

export const GATEWAY_POLL_DELAY_LIMIT_MS = 10_000;

export type VolcengineTimingTrace = {
  kind: "volcengine_timing";
  vendorCreatedAtMs?: number;
  vendorUpdatedAtMs?: number;
  firstQueuedAtMs?: number;
  firstRunningAtMs?: number;
  vendorSucceededAtMs?: number;
  lastStatus?: string;
  lastPolledAtMs?: number;
};

export type VolcengineTimingBreakdown = {
  queueMs: number | null;
  generateMs: number | null;
  pollDelayMs: number | null;
  pollDelayOverLimit: boolean;
};

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function parseUnixMs(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
  }
  return undefined;
}

function readNestedTimestamps(raw: unknown): {
  createdAtMs?: number;
  updatedAtMs?: number;
} {
  if (!raw || typeof raw !== "object") return {};
  const root = raw as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;
  const from = nested ?? root;
  return {
    createdAtMs: parseUnixMs(from.created_at ?? root.created_at),
    updatedAtMs: parseUnixMs(from.updated_at ?? root.updated_at),
  };
}

export function readVolcengineTimingTrace(
  resultSummary: unknown,
): VolcengineTimingTrace | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  const gateway = root._gateway;
  if (gateway && typeof gateway === "object") {
    const trace = (gateway as Record<string, unknown>).volcengineTiming;
    if (trace && typeof trace === "object") {
      return trace as VolcengineTimingTrace;
    }
  }
  const direct = root.volcengineTiming;
  if (direct && typeof direct === "object") {
    return direct as VolcengineTimingTrace;
  }
  return null;
}

export function readVolcengineTimingBreakdown(
  resultSummary: unknown,
): VolcengineTimingBreakdown | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const root = resultSummary as Record<string, unknown>;
  const gateway = root._gateway;
  if (gateway && typeof gateway === "object") {
    const breakdown = (gateway as Record<string, unknown>).timingBreakdown;
    if (breakdown && typeof breakdown === "object") {
      return breakdown as VolcengineTimingBreakdown;
    }
  }
  return null;
}

export function mergeVolcengineTimingTrace(
  existing: VolcengineTimingTrace | null,
  input: {
    status: string;
    raw: unknown;
    polledAtMs?: number;
  },
): VolcengineTimingTrace {
  const now = input.polledAtMs ?? Date.now();
  const status = normalizeStatus(input.status);
  const { createdAtMs, updatedAtMs } = readNestedTimestamps(input.raw);

  const trace: VolcengineTimingTrace = {
    kind: "volcengine_timing",
    ...existing,
    lastStatus: status,
    lastPolledAtMs: now,
  };

  if (createdAtMs != null) {
    trace.vendorCreatedAtMs = trace.vendorCreatedAtMs ?? createdAtMs;
  }
  if (updatedAtMs != null) {
    trace.vendorUpdatedAtMs = updatedAtMs;
  }

  if (status === "queued" && trace.firstQueuedAtMs == null) {
    trace.firstQueuedAtMs = now;
  }
  if (status === "running" || status === "processing") {
    if (trace.firstRunningAtMs == null) trace.firstRunningAtMs = now;
  }
  if (
    status === "succeeded" ||
    status === "completed" ||
    status === "success"
  ) {
    trace.vendorSucceededAtMs = updatedAtMs ?? now;
    if (updatedAtMs != null) trace.vendorUpdatedAtMs = updatedAtMs;
    if (trace.firstRunningAtMs == null && updatedAtMs != null) {
      // 单次轮询直接从 queued 跳到 succeeded 时，用 vendor 时间轴兜底
      trace.firstRunningAtMs = trace.vendorCreatedAtMs ?? trace.firstQueuedAtMs;
    }
  }

  return trace;
}

export function computeVolcengineTimingBreakdown(input: {
  trace: VolcengineTimingTrace;
  submittedAtMs: number;
  completedAtMs: number | null;
  nowMs?: number;
}): VolcengineTimingBreakdown {
  const now = input.nowMs ?? Date.now();
  const submitted = input.submittedAtMs;
  const trace = input.trace;
  const vendorUpdated = trace.vendorUpdatedAtMs ?? trace.vendorSucceededAtMs;
  const vendorCreated = trace.vendorCreatedAtMs;
  const firstRunning = trace.firstRunningAtMs;
  const firstQueued = trace.firstQueuedAtMs;
  const isTerminal = input.completedAtMs != null;

  let queueMs: number | null = null;
  if (firstRunning != null) {
    queueMs = Math.max(0, firstRunning - submitted);
  } else if (!isTerminal && (trace.lastStatus === "queued" || firstQueued != null)) {
    queueMs = Math.max(0, now - submitted);
  } else if (isTerminal && vendorCreated != null) {
    queueMs = Math.max(0, vendorCreated - submitted);
  }

  let generateMs: number | null = null;
  if (firstRunning != null && vendorUpdated != null && isTerminal) {
    generateMs = Math.max(0, vendorUpdated - firstRunning);
  } else if (firstRunning != null && !isTerminal) {
    generateMs = Math.max(0, now - firstRunning);
  } else if (isTerminal && vendorCreated != null && vendorUpdated != null) {
    generateMs = Math.max(0, vendorUpdated - vendorCreated);
  }

  let pollDelayMs: number | null = null;
  if (isTerminal && vendorUpdated != null && input.completedAtMs != null) {
    pollDelayMs = Math.max(0, input.completedAtMs - vendorUpdated);
  }

  return {
    queueMs,
    generateMs,
    pollDelayMs,
    pollDelayOverLimit:
      pollDelayMs != null && pollDelayMs > GATEWAY_POLL_DELAY_LIMIT_MS,
  };
}

export function attachGatewayTimingToSummary(
  existing: unknown,
  trace: VolcengineTimingTrace,
  breakdown: VolcengineTimingBreakdown,
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
    volcengineTiming: trace,
    timingBreakdown: breakdown,
  };
  return obj;
}

export function resolveVolcengineLogTiming(input: {
  providerKind: string | null;
  requestKind: string;
  submittedAt: Date;
  completedAt: Date | null;
  resultSummary: unknown;
  nowMs?: number;
}): VolcengineTimingBreakdown | null {
  if (input.providerKind !== "VOLCENGINE" || input.requestKind !== "VIDEO") {
    return null;
  }

  const stored = readVolcengineTimingBreakdown(input.resultSummary);
  const trace = readVolcengineTimingTrace(input.resultSummary);
  if (!trace) return stored;

  const live = computeVolcengineTimingBreakdown({
    trace,
    submittedAtMs: input.submittedAt.getTime(),
    completedAtMs: input.completedAt?.getTime() ?? null,
    nowMs: input.nowMs,
  });

  if (!input.completedAt) return live;
  return stored ?? live;
}
