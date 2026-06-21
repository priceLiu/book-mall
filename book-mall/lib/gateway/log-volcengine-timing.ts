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

  // 终态：Poll Δ = 厂商完成 → 我方记录完成的滞后，>10s 即异常。
  // 生成中：Poll Δ = 我方轮询间隔，正常可达数十秒，仅当超过轮询中断阈值（2min）
  // 才视为我方轮询停摆（卡死信号），避免正常长视频频繁误报。
  const pollLimit = isTerminal
    ? GATEWAY_POLL_DELAY_LIMIT_MS
    : VOLCENGINE_GATEWAY_POLL_GAP_MS;
  return {
    queueMs,
    generateMs,
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
 * 卡死收口判定：running 火山视频「厂商停更时长」≥ 阈值（默认 18min）→ 视为卡死。
 *
 * 以厂商停更时长为准而非"无 poll N 秒"：
 *  - 厂商真卡住（updated_at 长期不动）：停更时长照常增长 → 命中；
 *  - 我方 poll loop 挂掉（DB 503 等）：停更时长同样随墙钟增长 → 命中（覆盖图 7 场景）；
 *  - 正常长视频：阈值远高于实测最长生成（~744s），不会误杀。
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
