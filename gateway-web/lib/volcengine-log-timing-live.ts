/** 与 book-mall log-volcengine-timing 对齐 · 日志页 live 墙钟拆分 */

/** 厂商停更 / 轮询失联超过此间隔 → 视为「失联」，冻结生成墙钟，避免数字无界上涨（与 book-mall VOLCENGINE_GATEWAY_POLL_GAP_MS 对齐） */
export const VOLCENGINE_LIVE_POLL_GAP_MS = 2 * 60 * 1000;

type VolcengineTimingTrace = {
  vendorCreatedAtMs?: number;
  vendorUpdatedAtMs?: number;
  vendorUpdatedStaleSinceMs?: number;
  firstRunningAtMs?: number;
  lastPolledAtMs?: number;
  lastStatus?: string;
};

function isVendorTerminalStatus(status: string): boolean {
  return (
    status === "succeeded" ||
    status === "completed" ||
    status === "success" ||
    status === "failed" ||
    status === "cancelled"
  );
}

export function hasVolcengineTimingTrace(resultSummary: unknown): boolean {
  return readVolcengineTimingTrace(resultSummary) != null;
}

function readVolcengineTimingTrace(
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

function normalizeStatus(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function isSeedanceFrozenUpdatedAt(
  vendorCreated: number | undefined,
  vendorUpdated: number | undefined,
): boolean {
  if (vendorCreated == null || vendorUpdated == null) return false;
  return vendorUpdated - vendorCreated <= 5_000;
}

function volcengineVendorGpuMs(trace: VolcengineTimingTrace): number | null {
  const created = trace.vendorCreatedAtMs;
  const updated = trace.vendorUpdatedAtMs;
  if (created == null || updated == null) return null;
  if (isSeedanceFrozenUpdatedAt(created, updated)) return null;
  return Math.max(0, updated - created);
}

/** 进行中火山视频 · 分阶段计时（与 book-mall computeVolcengineTimingBreakdown 一致） */
export function liveVolcengineVideoTiming(input: {
  submittedAt: string;
  completedAt: string | null;
  resultSummary: unknown;
  nowMs: number;
}): {
  queueMs: number;
  generateMs: number | null;
  vendorPostProcessMs: number | null;
  pollDelayMs: number;
  totalMs: number;
  /** 厂商停更 / 轮询失联超阈值：生成/后处理墙钟已冻结，待主动核对（UI 标黄） */
  stalled: boolean;
} | null {
  const trace = readVolcengineTimingTrace(input.resultSummary);
  if (!trace) return null;
  const genStart = trace.vendorCreatedAtMs ?? trace.firstRunningAtMs;
  if (genStart == null) return null;

  const submittedMs = new Date(input.submittedAt).getTime();
  const queueMs = Math.max(0, genStart - submittedMs);

  const st = normalizeStatus(trace.lastStatus);
  const vendorUpdated = trace.vendorUpdatedAtMs;

  // 失联检测：厂商 updated_at 停更 或 我方 lastPolledAt 距今超过阈值 → 视为轮询失联。
  // 此时不应继续把「生成」按墙钟无界递增（多半厂商早已返回，只是没 poll 到），
  // 冻结在「最后一次与厂商/轮询有接触的时刻」，并交由上层标黄、触发主动核对。
  const lastPolled = trace.lastPolledAtMs;
  const staleAnchor =
    trace.vendorUpdatedStaleSinceMs ?? vendorUpdated ?? lastPolled ?? genStart;
  const stalled = input.nowMs - staleAnchor > VOLCENGINE_LIVE_POLL_GAP_MS;
  // 冻结参考时刻：失联时仅累计到「最后接触时刻」，否则用当前墙钟。
  const liveRef = stalled
    ? Math.max(genStart, lastPolled ?? vendorUpdated ?? staleAnchor)
    : input.nowMs;

  // 阶段秒表（与服务端一致）：
  //  · updated_at 已跳变 → 生成冻结为 GPU 真值，仍 running 则后处理走墙钟；
  //  · Seedance updated 恒等于 created → 生成按墙钟实时累计（GPU 真值终态回填）。
  let generateMs: number | null = null;
  let vendorPostProcessMs: number | null = null;
  const gpuMs = volcengineVendorGpuMs(trace);
  if (gpuMs != null) {
    generateMs = gpuMs;
    if (vendorUpdated != null && (st === "running" || st === "processing")) {
      vendorPostProcessMs = Math.max(0, liveRef - vendorUpdated);
    }
  } else {
    generateMs = Math.max(0, liveRef - genStart);
  }

  const pollDelayMs =
    lastPolled != null ? Math.max(0, input.nowMs - lastPolled) : 0;

  return {
    queueMs,
    generateMs,
    vendorPostProcessMs,
    pollDelayMs,
    totalMs: Math.max(0, input.nowMs - submittedMs),
    stalled,
  };
}

function isInProgressStatus(status: string): boolean {
  const s = status.trim().toUpperCase();
  return s === "RUNNING" || s === "PENDING";
}

/** 进行中任务 · 各阶段（火山 trace 优先；无 trace 时不外推厂商生成墙钟） */
export function resolveLiveLogPhaseTiming(input: {
  submittedAt: string;
  completedAt: string | null;
  status: string;
  resultSummary: unknown;
  nowMs: number | null;
  server: {
    queueMs?: number | null;
    generateMs?: number | null;
    vendorPostProcessMs?: number | null;
    pollDelayMs?: number | null;
  };
}): {
  queueMs: number | null;
  generateMs: number | null;
  vendorPostProcessMs: number | null;
  pollDelayMs: number | null;
  totalMs: number | null;
  stalled: boolean;
} {
  const server = input.server;
  const inProgress = isInProgressStatus(input.status);
  if (!inProgress || input.nowMs == null) {
    return {
      queueMs: server.queueMs ?? null,
      generateMs: server.generateMs ?? null,
      vendorPostProcessMs: server.vendorPostProcessMs ?? null,
      pollDelayMs: server.pollDelayMs ?? null,
      totalMs: null,
      stalled: false,
    };
  }

  const volc = liveVolcengineVideoTiming({
    submittedAt: input.submittedAt,
    completedAt: input.completedAt,
    resultSummary: input.resultSummary,
    nowMs: input.nowMs,
  });
  if (volc) {
    return volc;
  }

  const submittedMs = new Date(input.submittedAt).getTime();
  return {
    queueMs: server.queueMs ?? null,
    generateMs: server.generateMs ?? null,
    vendorPostProcessMs: server.vendorPostProcessMs ?? null,
    pollDelayMs: server.pollDelayMs ?? null,
    totalMs: Math.max(0, input.nowMs - submittedMs),
    stalled: false,
  };
}

/** 火山 trace 原生跨度终点（GPU 进行中 → null） */
function resolveVolcengineVendorTraceEndMs(
  trace: VolcengineTimingTrace,
): number | null {
  if (trace.vendorCreatedAtMs == null) return null;
  const st = normalizeStatus(trace.lastStatus);
  const terminal = isVendorTerminalStatus(st);
  const created = trace.vendorCreatedAtMs;
  const updated = trace.vendorUpdatedAtMs;

  if (terminal) {
    return updated ?? created;
  }
  if (updated != null && !isSeedanceFrozenUpdatedAt(created, updated)) {
    return updated;
  }
  return null;
}

/** 厂商原生耗时（只读；阶段完成才出数） */
export function resolveVendorNativeTimingLive(input: {
  providerKind: string | null;
  requestKind: string;
  vendorDurationMs?: number | null;
  resultSummary: unknown;
  nowMs: number;
  server?: {
    vendorNativeDurationMs?: number | null;
    vendorNativeGenerateMs?: number | null;
  };
}): {
  vendorNativeDurationMs: number | null;
  vendorNativeGenerateMs: number | null;
} {
  const reported =
    input.vendorDurationMs != null && input.vendorDurationMs > 0
      ? input.vendorDurationMs
      : null;

  let vendorTraceSpanMs: number | null = null;
  if (input.providerKind === "VOLCENGINE" && input.requestKind === "VIDEO") {
    const trace = readVolcengineTimingTrace(input.resultSummary);
    if (trace?.vendorCreatedAtMs != null) {
      const end = resolveVolcengineVendorTraceEndMs(trace);
      if (end != null) {
        vendorTraceSpanMs = Math.max(0, end - trace.vendorCreatedAtMs);
      }
    }
  }

  const vendorNativeDurationMs = reported ?? vendorTraceSpanMs;
  let vendorNativeGenerateMs: number | null = null;
  if (input.providerKind === "VOLCENGINE" && input.requestKind === "VIDEO") {
    vendorNativeGenerateMs = vendorTraceSpanMs;
  } else if (reported != null) {
    vendorNativeGenerateMs = reported;
  }

  if (
    vendorNativeDurationMs == null &&
    input.server?.vendorNativeDurationMs != null
  ) {
    return {
      vendorNativeDurationMs: input.server.vendorNativeDurationMs,
      vendorNativeGenerateMs:
        vendorNativeGenerateMs ?? input.server.vendorNativeGenerateMs ?? null,
    };
  }

  return { vendorNativeDurationMs, vendorNativeGenerateMs };
}
