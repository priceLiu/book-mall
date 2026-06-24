/**
 * Gateway 日志 · 火山视频任务耗时拆分（排队 / 生成 / 轮询延迟）
 *
 * - 排队：Gateway submittedAt → 厂商 created_at（无则回退首次 poll 观测 running）
 * - 生成（进行中）：墙钟 now − genStart
 * - 后处理（终态）：首次观测 succeeded − vendor updated_at（Seedance 常见 status 仍 running）
 * - 轮询延迟 Poll Δ（终态）：Gateway completedAt − 首次观测 succeeded
 */

export const GATEWAY_POLL_DELAY_LIMIT_MS = 10_000;
/** queued 阶段 updated_at 停更超过此阈值 → 排队卡死 */
export const VOLCENGINE_QUEUED_STALE_MS = 10 * 60 * 1000;
/** running 且厂商已返回终态、Gateway 仍未 completed 超过此阈值 → 诊断用 */
export const VOLCENGINE_POLL_LAG_FAIL_MS = 2 * 60 * 1000;
/** Gateway 未 poll 超过此间隔视为轮询中断 */
export const VOLCENGINE_GATEWAY_POLL_GAP_MS = 2 * 60 * 1000;

/**
 * 自动释放（卡死收口）阈值：以「厂商停更时长」为准。
 *
 * running 火山视频自厂商 updated_at 最近一次推进起（Seedance 生成期间 updated_at 恒等于
 * created_at，故等价于"自厂商建任务起的生成墙钟"）超过此值仍未转终态 → 判定卡死，收口
 * 并释放交通槽。该口径同时覆盖"我方轮询中断"（loop 挂掉时停更时长照常随墙钟增长）。
 *
 * 取值依据：实测正常生成（含高负载）最长约 744s（~12.4min）。默认 10min（600s）以求卡死后尽快
 * 释放槽位；注意此值已接近实测最长生成时长，若线上出现"正常长视频被误判卡死"的情况，
 * 通过环境变量 VOLCENGINE_VENDOR_STALE_RELEASE_MS 上调（单位 ms，下限 60s）。
 */
export const VOLCENGINE_VENDOR_STALE_RELEASE_MS = (() => {
  const raw = Number(process.env.VOLCENGINE_VENDOR_STALE_RELEASE_MS);
  return Number.isFinite(raw) && raw >= 60_000 ? raw : 10 * 60 * 1000;
})();

/** @deprecated 旧的"无 poll 800s"口径，保留导出避免外部引用断裂；释放改用厂商停更时长。 */
export const VOLCENGINE_GATEWAY_POLL_STALL_MS = VOLCENGINE_VENDOR_STALE_RELEASE_MS;

export type VolcengineTimingTrace = {
  kind: "volcengine_timing";
  vendorCreatedAtMs?: number;
  vendorUpdatedAtMs?: number;
  /** 连续 poll 回包相同 updated_at 的起始时刻 */
  vendorUpdatedStaleSinceMs?: number;
  firstQueuedAtMs?: number;
  firstRunningAtMs?: number;
  vendorSucceededAtMs?: number;
  /** 首次 poll 观测到厂商 succeeded/completed 的墙钟时刻 */
  firstSucceededPolledAtMs?: number;
  /** 首次 poll 观测到厂商 failed/cancelled 的墙钟时刻 */
  firstFailedPolledAtMs?: number;
  lastStatus?: string;
  lastPolledAtMs?: number;
};

export type VolcengineTimingBreakdown = {
  queueMs: number | null;
  generateMs: number | null;
  /** 终态：厂商 updated_at 跳变后至首次 succeeded 的后处理/状态滞后（进行中为 null） */
  vendorPostProcessMs: number | null;
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
    if (trace.firstSucceededPolledAtMs == null) {
      trace.firstSucceededPolledAtMs = now;
    }
    trace.vendorSucceededAtMs = updatedAtMs ?? now;
    if (updatedAtMs != null) trace.vendorUpdatedAtMs = updatedAtMs;
    if (trace.firstRunningAtMs == null && updatedAtMs != null) {
      trace.firstRunningAtMs = trace.vendorCreatedAtMs ?? trace.firstQueuedAtMs;
    }
  }
  if (status === "failed" || status === "cancelled") {
    if (trace.firstFailedPolledAtMs == null) {
      trace.firstFailedPolledAtMs = now;
    }
    if (updatedAtMs != null) trace.vendorUpdatedAtMs = updatedAtMs;
  }

  return trace;
}

export function volcengineTimingGenStartMs(
  trace: VolcengineTimingTrace,
): number | null {
  return trace.vendorCreatedAtMs ?? trace.firstRunningAtMs ?? null;
}

function isVendorTerminalStatus(status: string | undefined): boolean {
  const s = normalizeStatus(status);
  return (
    s === "succeeded" ||
    s === "completed" ||
    s === "success" ||
    s === "failed" ||
    s === "cancelled"
  );
}

function isVendorFailedStatus(status: string | undefined): boolean {
  const s = normalizeStatus(status);
  return s === "failed" || s === "cancelled";
}

/** Seedance 生成中 updated_at 长期等于 created_at */
function isSeedanceFrozenUpdatedAt(
  vendorCreated: number | undefined,
  vendorUpdated: number | undefined,
): boolean {
  if (vendorCreated == null || vendorUpdated == null) return false;
  return vendorUpdated - vendorCreated <= 5_000;
}

/** 终态失败/取消：首次观测到厂商终态的墙钟（优先 failed，回退 lastPolled） */
export function resolveFirstFailedPolledAtMs(
  trace: VolcengineTimingTrace,
): number | null {
  if (trace.firstFailedPolledAtMs != null) return trace.firstFailedPolledAtMs;
  if (isVendorFailedStatus(trace.lastStatus)) {
    return trace.lastPolledAtMs ?? null;
  }
  return null;
}

/** 终态拆分用：首次观测 succeeded 的墙钟（旧日志回退 lastPolledAtMs） */
export function resolveFirstSucceededPolledAtMs(
  trace: VolcengineTimingTrace,
  completedAtMs: number,
): number | null {
  if (trace.firstSucceededPolledAtMs != null) {
    return trace.firstSucceededPolledAtMs;
  }
  const st = normalizeStatus(trace.lastStatus);
  if (st === "succeeded" || st === "completed" || st === "success") {
    return trace.lastPolledAtMs ?? completedAtMs;
  }
  return null;
}

function splitTerminalWithoutSucceeded(input: {
  trace: VolcengineTimingTrace;
  completedAtMs: number;
  genStart: number | null;
  vendorCreated: number | undefined;
  vendorUpdated: number | undefined;
  firstRunning: number | undefined;
}): Pick<
  VolcengineTimingBreakdown,
  "generateMs" | "vendorPostProcessMs" | "pollDelayMs"
> {
  const genBase =
    input.genStart ?? input.vendorCreated ?? input.firstRunning ?? null;
  if (genBase == null) {
    return { generateMs: null, vendorPostProcessMs: null, pollDelayMs: null };
  }

  const vendorFailedAt = resolveFirstFailedPolledAtMs(input.trace);
  if (vendorFailedAt != null) {
    return {
      generateMs: Math.max(0, vendorFailedAt - genBase),
      vendorPostProcessMs: null,
      pollDelayMs: Math.max(0, input.completedAtMs - vendorFailedAt),
    };
  }

  const lastPoll = input.trace.lastPolledAtMs;
  const totalMs = Math.max(0, input.completedAtMs - genBase);
  const pollDelayMs =
    lastPoll != null ? Math.max(0, input.completedAtMs - lastPoll) : 0;
  const generateMs = Math.max(0, totalMs - pollDelayMs);

  if (
    isSeedanceFrozenUpdatedAt(input.vendorCreated, input.vendorUpdated) &&
    generateMs <= 5_000 &&
    totalMs > 60_000
  ) {
    // 旧日志：updated_at 不前进且无 failed 观测 → 全段为 Gateway 等厂商，不归入 PostProc
    return {
      generateMs: totalMs,
      vendorPostProcessMs: null,
      pollDelayMs: pollDelayMs > 0 ? pollDelayMs : null,
    };
  }

  return {
    generateMs,
    vendorPostProcessMs: null,
    pollDelayMs: pollDelayMs > 0 ? pollDelayMs : null,
  };
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
  let vendorPostProcessMs: number | null = null;
  let pollDelayMs: number | null = null;

  if (!isTerminal) {
    // 火山 Seedance 生成中 updated_at 不前进（恒等于 created_at，直到出结果才跳到完成
    // 时刻），故生成中无法用 vendor updated_at 拆分。Generate 直接走墙钟
    // （now − genStart，持续增长 = 仍在生成）；Poll Δ 表示「我方轮询延迟」
    // （now − 最近一次成功 poll），正常 ≈ 轮询间隔，仅当我方轮询停摆才增大，
    // 同时作为卡死信号。（终态拆分仍以 vendor updated_at 为准，见下。）
    // 仅在已进入 running 后计 Generate；纯 queued（厂商尚未开始生成）不计生成。
    const st = normalizeStatus(trace.lastStatus);
    const hasStartedRunning =
      st === "running" || st === "processing" || firstRunning != null;
    if (hasStartedRunning) {
      const base = genStart ?? firstRunning;
      if (base != null) generateMs = Math.max(0, now - base);
    }
    const lastPolled = trace.lastPolledAtMs;
    pollDelayMs = lastPolled != null ? Math.max(0, now - lastPolled) : 0;
    // 进行中：updated_at 已跳离 created_at 但 status 仍 running → 实时后处理墙钟
    if (
      vendorUpdated != null &&
      vendorCreated != null &&
      vendorUpdated > vendorCreated &&
      (st === "running" || st === "processing")
    ) {
      generateMs = Math.max(0, vendorUpdated - (genStart ?? vendorCreated));
      vendorPostProcessMs = Math.max(0, now - vendorUpdated);
    }
  } else if (vendorCreated != null && vendorUpdated != null) {
    generateMs = Math.max(0, vendorUpdated - vendorCreated);
    if (input.completedAtMs != null) {
      const firstSucceeded = resolveFirstSucceededPolledAtMs(
        trace,
        input.completedAtMs,
      );
      if (firstSucceeded != null) {
        vendorPostProcessMs = Math.max(0, firstSucceeded - vendorUpdated);
        pollDelayMs = Math.max(0, input.completedAtMs - firstSucceeded);
      } else {
        const split = splitTerminalWithoutSucceeded({
          trace,
          completedAtMs: input.completedAtMs,
          genStart,
          vendorCreated,
          vendorUpdated,
          firstRunning,
        });
        generateMs = split.generateMs;
        vendorPostProcessMs = split.vendorPostProcessMs;
        pollDelayMs = split.pollDelayMs;
      }
    }
  } else if (firstRunning != null && vendorUpdated != null) {
    generateMs = Math.max(0, vendorUpdated - firstRunning);
    if (input.completedAtMs != null) {
      const firstSucceeded = resolveFirstSucceededPolledAtMs(
        trace,
        input.completedAtMs,
      );
      if (firstSucceeded != null) {
        vendorPostProcessMs = Math.max(0, firstSucceeded - vendorUpdated);
        pollDelayMs = Math.max(0, input.completedAtMs - firstSucceeded);
      } else {
        const split = splitTerminalWithoutSucceeded({
          trace,
          completedAtMs: input.completedAtMs,
          genStart,
          vendorCreated,
          vendorUpdated,
          firstRunning,
        });
        generateMs = split.generateMs ?? generateMs;
        vendorPostProcessMs = split.vendorPostProcessMs;
        pollDelayMs = split.pollDelayMs;
      }
    }
  }

  // 终态：Poll Δ = 首次 succeeded → Gateway completedAt，>10s 即异常。
  // 生成中：Poll Δ = 我方轮询间隔，正常可达数十秒，仅当超过轮询中断阈值（2min）
  // 才视为我方轮询停摆（卡死信号），避免正常长视频频繁误报。
  const pollLimit = isTerminal
    ? GATEWAY_POLL_DELAY_LIMIT_MS
    : VOLCENGINE_GATEWAY_POLL_GAP_MS;
  return {
    queueMs,
    generateMs,
    vendorPostProcessMs,
    pollDelayMs,
    pollDelayOverLimit: pollDelayMs != null && pollDelayMs > pollLimit,
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

/** 终态 completedAt：优先首次观测厂商终态的墙钟，避免延迟 recover 用 Date.now() 扭曲拆分。 */
export function resolveVolcengineTerminalCompletedAtMs(input: {
  trace: VolcengineTimingTrace;
  status: "SUCCEEDED" | "FAILED";
  submittedAtMs: number;
  fallbackNowMs?: number;
}): number {
  const fallbackNowMs = input.fallbackNowMs ?? Date.now();
  const { trace, status, submittedAtMs } = input;

  if (status === "SUCCEEDED") {
    const firstSucc = resolveFirstSucceededPolledAtMs(trace, fallbackNowMs);
    if (firstSucc != null) return Math.max(firstSucc, submittedAtMs);
    if (trace.vendorUpdatedAtMs != null) {
      return Math.max(trace.vendorUpdatedAtMs, submittedAtMs);
    }
    return fallbackNowMs;
  }

  const firstFail = resolveFirstFailedPolledAtMs(trace);
  if (firstFail != null) return Math.max(firstFail, submittedAtMs);
  if (trace.vendorUpdatedAtMs != null) {
    return Math.max(trace.vendorUpdatedAtMs, submittedAtMs);
  }
  return fallbackNowMs;
}

/** 终态 Duration：各阶段之和；无法拆分时回退 completedAt − submittedAt。 */
export function sumVolcengineTimingBreakdownMs(input: {
  breakdown: VolcengineTimingBreakdown;
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

/** 火山视频终态收口：冻结 trace + 阶段拆分 + completedAt / durationMs。 */
export function buildVolcengineTerminalFinalizeMetrics(input: {
  trace: VolcengineTimingTrace;
  status: "SUCCEEDED" | "FAILED";
  submittedAt: Date;
  resultSummaryBase: unknown;
  fallbackNowMs?: number;
}): {
  completedAtMs: number;
  durationMs: number;
  breakdown: VolcengineTimingBreakdown;
  resultSummary: Record<string, unknown>;
} {
  const submittedAtMs = input.submittedAt.getTime();
  const fallbackNowMs = input.fallbackNowMs ?? Date.now();
  const completedAtMs = resolveVolcengineTerminalCompletedAtMs({
    trace: input.trace,
    status: input.status,
    submittedAtMs,
    fallbackNowMs,
  });
  const breakdown = computeVolcengineTimingBreakdown({
    trace: input.trace,
    submittedAtMs,
    completedAtMs,
  });
  const durationMs = sumVolcengineTimingBreakdownMs({
    breakdown,
    submittedAtMs,
    completedAtMs,
  });
  const resultSummary = attachGatewayTimingToSummary(
    input.resultSummaryBase,
    input.trace,
    breakdown,
  );
  return { completedAtMs, durationMs, breakdown, resultSummary };
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

  // 终态：优先落库时的 timingBreakdown，避免延迟 recover 后 UI 重算覆盖真实阶段耗时
  if (input.completedAt != null && stored) {
    return stored;
  }

  return computeVolcengineTimingBreakdown({
    trace,
    submittedAtMs: input.submittedAt.getTime(),
    completedAtMs: input.completedAt?.getTime() ?? null,
    nowMs: input.nowMs,
  });
}

/** 厂商 API / trace 原生耗时（只读展示，不写回 DB） */
export type VendorNativeTiming = {
  /** 厂商显式字段（如 KIE costTime → vendorDurationMs） */
  vendorReportedMs: number | null;
  /** 火山 trace：created_at → updated_at */
  vendorTraceSpanMs: number | null;
};

export function resolveVendorNativeTiming(input: {
  providerKind: string | null;
  requestKind: string;
  vendorDurationMs: number | null;
  resultSummary: unknown;
  nowMs?: number;
}): VendorNativeTiming {
  const now = input.nowMs ?? Date.now();
  const vendorReportedMs =
    input.vendorDurationMs != null && input.vendorDurationMs > 0
      ? input.vendorDurationMs
      : null;

  let vendorTraceSpanMs: number | null = null;
  if (
    input.providerKind === "VOLCENGINE" &&
    input.requestKind === "VIDEO"
  ) {
    const trace = readVolcengineTimingTrace(input.resultSummary);
    if (trace?.vendorCreatedAtMs != null) {
      const st = normalizeStatus(trace.lastStatus);
      const terminal = isVendorTerminalStatus(st);
      const end =
        trace.vendorUpdatedAtMs != null
          ? trace.vendorUpdatedAtMs
          : terminal
            ? trace.vendorCreatedAtMs
            : now;
      vendorTraceSpanMs = Math.max(0, end - trace.vendorCreatedAtMs);
    }
  }

  return { vendorReportedMs, vendorTraceSpanMs };
}

/** Gateway 日志 API · 厂商原生列（与 Duration / Generate 并列对比，不回写） */
export function resolveVendorNativeTimingForLogRow(input: {
  providerKind: string | null;
  requestKind: string;
  vendorDurationMs: number | null;
  resultSummary: unknown;
  nowMs?: number;
}): {
  vendorNativeDurationMs: number | null;
  vendorNativeGenerateMs: number | null;
} {
  const native = resolveVendorNativeTiming(input);
  const vendorNativeDurationMs =
    native.vendorReportedMs ?? native.vendorTraceSpanMs;
  let vendorNativeGenerateMs: number | null = null;
  if (input.providerKind === "VOLCENGINE" && input.requestKind === "VIDEO") {
    vendorNativeGenerateMs = native.vendorTraceSpanMs;
  } else if (native.vendorReportedMs != null) {
    vendorNativeGenerateMs = native.vendorReportedMs;
  }
  return { vendorNativeDurationMs, vendorNativeGenerateMs };
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

/** 自厂商 updated_at 最近一次推进起的「停更时长」（ms）；无任何时间锚则为 null。 */
export function volcengineVendorStaleMs(
  trace: VolcengineTimingTrace,
  nowMs: number = Date.now(),
): number | null {
  const staleSince = trace.vendorUpdatedAtMs ?? volcengineTimingGenStartMs(trace);
  if (staleSince == null) return null;
  return Math.max(0, nowMs - staleSince);
}

/**
 * 是否满足「转入持续后台生成」的 vendor 进度特征（running 且 updated_at 长期不变）。
 * 仅用于 promoteVolcengineTasksToBackgroundGeneration，**不再**触发 FAILED。
 */
export function isVolcengineVendorStuck(
  trace: VolcengineTimingTrace,
  nowMs: number = Date.now(),
  staleMs: number = VOLCENGINE_VENDOR_STALE_RELEASE_MS,
): boolean {
  if (normalizeStatus(trace.lastStatus) !== "running") return false;
  const stale = volcengineVendorStaleMs(trace, nowMs);
  return stale != null && stale >= staleMs;
}

/**
 * @deprecated 改用 isVolcengineVendorStuck（以厂商停更时长为准）。保留旧签名以兼容引用方；
 * lastPolledAt 参数已不再参与判定。
 */
export function isVolcengineGatewayPollStalled(
  trace: VolcengineTimingTrace,
  _lastPolledAt?: Date | null,
  nowMs: number = Date.now(),
  staleMs: number = VOLCENGINE_VENDOR_STALE_RELEASE_MS,
): boolean {
  return isVolcengineVendorStuck(trace, nowMs, staleMs);
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
