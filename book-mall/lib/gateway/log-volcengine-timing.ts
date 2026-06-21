/**
 * Gateway 日志 · 火山视频任务耗时拆分（排队 / 生成 / 轮询延迟）
 *
 * - 排队：Gateway submittedAt → 厂商 created_at（无则回退首次 poll 观测 running）
 * - 生成（进行中）：墙钟 now − genStart
 * - 轮询延迟（终态）：Gateway completedAt − vendor updated_at
 */

export const GATEWAY_POLL_DELAY_LIMIT_MS = 10_000;
/** queued 阶段 updated_at 停更超过此阈值 → 排队卡死 */
export const VOLCENGINE_QUEUED_STALE_MS = 10 * 60 * 1000;
/** running 且厂商已返回终态、Gateway 仍未 completed 超过此阈值 → 诊断用 */
export const VOLCENGINE_POLL_LAG_FAIL_MS = 2 * 60 * 1000;
/** 厂商 updated_at 停更 + Gateway 轮询中断超过此阈值 → 自动收口（与慢任务预警 800s 对齐） */
export const VOLCENGINE_GATEWAY_POLL_STALL_MS = 800 * 1000;
/** Gateway 未 poll 超过此间隔视为轮询中断 */
export const VOLCENGINE_GATEWAY_POLL_GAP_MS = 2 * 60 * 1000;

export type VolcengineTimingTrace = {
  kind: "volcengine_timing";
  vendorCreatedAtMs?: number;
  vendorUpdatedAtMs?: number;
  /** 连续 poll 回包相同 updated_at 的起始时刻 */
  vendorUpdatedStaleSinceMs?: number;
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
    const prevUpdated = trace.vendorUpdatedAtMs;
    if (prevUpdated != null && updatedAtMs === prevUpdated) {
      trace.vendorUpdatedStaleSinceMs =
        trace.vendorUpdatedStaleSinceMs ?? now;
    } else {
      trace.vendorUpdatedAtMs = updatedAtMs;
      trace.vendorUpdatedStaleSinceMs = undefined;
    }
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
      trace.firstRunningAtMs = trace.vendorCreatedAtMs ?? trace.firstQueuedAtMs;
    }
  }

  return trace;
}

export function volcengineTimingGenStartMs(
  trace: VolcengineTimingTrace,
): number | null {
  return trace.vendorCreatedAtMs ?? trace.firstRunningAtMs ?? null;
}

/** 连续两次 poll 回包相同 updated_at（仅用于诊断，进行中 Generate 仍走墙钟） */
export function isVolcengineVendorUpdatedFrozen(
  trace: VolcengineTimingTrace,
): boolean {
  return (
    trace.vendorUpdatedStaleSinceMs != null &&
    trace.vendorUpdatedAtMs != null
  );
}

/** Gateway 侧轮询滞后：厂商停更后墙钟 − vendor updated_at */
export function volcenginePollLagMs(
  trace: VolcengineTimingTrace,
  nowMs: number = Date.now(),
): number | null {
  if (!isVolcengineVendorUpdatedFrozen(trace)) return null;
  return Math.max(0, nowMs - trace.vendorUpdatedAtMs!);
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
  const genStart = volcengineTimingGenStartMs(trace);

  let queueMs: number | null = null;
  if (genStart != null) {
    queueMs = Math.max(0, genStart - submitted);
  } else if (firstRunning != null) {
    queueMs = Math.max(0, firstRunning - submitted);
  } else if (!isTerminal && (trace.lastStatus === "queued" || firstQueued != null)) {
    queueMs = Math.max(0, now - submitted);
  } else if (isTerminal && vendorCreated != null) {
    queueMs = Math.max(0, vendorCreated - submitted);
  }

  let generateMs: number | null = null;
  let pollDelayMs: number | null = null;

  if (!isTerminal) {
    if (genStart != null) {
      if (
        isVolcengineVendorUpdatedFrozen(trace) &&
        trace.vendorUpdatedAtMs != null
      ) {
        // 火山 running 时 updated_at 常不变：Generate 取厂商时间轴，停更计入 pollDelayMs
        generateMs = Math.max(0, trace.vendorUpdatedAtMs - genStart);
        pollDelayMs = Math.max(0, now - trace.vendorUpdatedAtMs);
      } else {
        generateMs = Math.max(0, now - genStart);
      }
    } else if (firstRunning != null) {
      generateMs = Math.max(0, now - firstRunning);
    }
  } else if (vendorCreated != null && vendorUpdated != null) {
    generateMs = Math.max(0, vendorUpdated - vendorCreated);
    if (input.completedAtMs != null) {
      pollDelayMs = Math.max(0, input.completedAtMs - vendorUpdated);
    }
  } else if (firstRunning != null && vendorUpdated != null) {
    generateMs = Math.max(0, vendorUpdated - firstRunning);
    if (input.completedAtMs != null) {
      pollDelayMs = Math.max(0, input.completedAtMs - vendorUpdated);
    }
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

/** queued 阶段 updated_at 长期停更 */
export function isVolcengineQueuedStale(
  trace: VolcengineTimingTrace,
  nowMs: number = Date.now(),
  staleMs: number = VOLCENGINE_QUEUED_STALE_MS,
): boolean {
  if (trace.vendorUpdatedStaleSinceMs == null) return false;
  if (normalizeStatus(trace.lastStatus) !== "queued") return false;
  return nowMs - trace.vendorUpdatedStaleSinceMs >= staleMs;
}

/**
 * 厂商 updated_at 停更已久且 Gateway 轮询已中断（如 DB 503 / poll worker 停）。
 * 与「正常长视频 running（lastPolledAt 仍刷新）」区分。
 */
export function isVolcengineGatewayPollStalled(
  trace: VolcengineTimingTrace,
  lastPolledAt: Date | null | undefined,
  nowMs: number = Date.now(),
  stallMs: number = VOLCENGINE_GATEWAY_POLL_STALL_MS,
  pollGapMs: number = VOLCENGINE_GATEWAY_POLL_GAP_MS,
): boolean {
  if (normalizeStatus(trace.lastStatus) !== "running") return false;
  const lag = volcenginePollLagMs(trace, nowMs);
  if (lag == null || lag < stallMs) return false;
  const lastPollMs = lastPolledAt?.getTime();
  if (lastPollMs == null || nowMs - lastPollMs < pollGapMs) return false;
  return true;
}

/** 厂商已返回终态，Gateway 日志仍未 completed（极少见，供诊断） */
export function isVolcenginePollLagCritical(
  trace: VolcengineTimingTrace,
  nowMs: number = Date.now(),
  failMs: number = VOLCENGINE_POLL_LAG_FAIL_MS,
): boolean {
  const status = normalizeStatus(trace.lastStatus);
  const vendorTerminal =
    status === "succeeded" ||
    status === "completed" ||
    status === "success" ||
    status === "failed" ||
    status === "cancelled";
  if (!vendorTerminal) return false;
  if (trace.lastPolledAtMs == null || trace.vendorUpdatedAtMs == null) return false;
  return nowMs - trace.lastPolledAtMs >= failMs;
}

/** @deprecated 使用 isVolcengineQueuedStale */
export function isVolcengineVendorUpdatedStale(
  trace: VolcengineTimingTrace,
  nowMs?: number,
  staleMs?: number,
): boolean {
  return isVolcengineQueuedStale(trace, nowMs, staleMs);
}
