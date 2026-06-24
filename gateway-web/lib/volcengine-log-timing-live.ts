/** 与 book-mall log-volcengine-timing 对齐 · 日志页 live 墙钟拆分 */

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
} | null {
  const trace = readVolcengineTimingTrace(input.resultSummary);
  if (!trace) return null;
  const genStart = trace.vendorCreatedAtMs ?? trace.firstRunningAtMs;
  if (genStart == null) return null;

  const submittedMs = new Date(input.submittedAt).getTime();
  const queueMs = Math.max(0, genStart - submittedMs);

  const st = normalizeStatus(trace.lastStatus);
  const vendorUpdated = trace.vendorUpdatedAtMs;
  const hasStartedRunning =
    st === "running" || st === "processing" || trace.firstRunningAtMs != null;

  let generateMs: number | null = null;
  let vendorPostProcessMs: number | null = null;
  const gpuMs = volcengineVendorGpuMs(trace);
  if (gpuMs != null) {
    generateMs = gpuMs;
    if (
      vendorUpdated != null &&
      (st === "running" || st === "processing")
    ) {
      vendorPostProcessMs = Math.max(0, input.nowMs - vendorUpdated);
    }
  } else if (hasStartedRunning) {
    generateMs = null;
  }

  const lastPolled = trace.lastPolledAtMs;
  const pollDelayMs =
    lastPolled != null ? Math.max(0, input.nowMs - lastPolled) : 0;

  return {
    queueMs,
    generateMs,
    vendorPostProcessMs,
    pollDelayMs,
    totalMs: Math.max(0, input.nowMs - submittedMs),
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
