/** 与 book-mall log-volcengine-timing 对齐 · 日志页 live 墙钟拆分 */

type VolcengineTimingTrace = {
  vendorCreatedAtMs?: number;
  vendorUpdatedAtMs?: number;
  vendorUpdatedStaleSinceMs?: number;
  firstRunningAtMs?: number;
  lastPolledAtMs?: number;
};

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
  return null;
}

/** 进行中火山视频 · Generate / Poll Δ 与 book-mall 一致（厂商 updated_at 停更后拆分） */
export function liveVolcengineVideoTiming(input: {
  submittedAt: string;
  completedAt: string | null;
  resultSummary: unknown;
  nowMs: number;
}): {
  queueMs: number;
  generateMs: number;
  pollDelayMs: number;
  totalMs: number;
} | null {
  if (input.completedAt) return null;
  const trace = readVolcengineTimingTrace(input.resultSummary);
  if (!trace) return null;
  const genStart = trace.vendorCreatedAtMs ?? trace.firstRunningAtMs;
  if (genStart == null) return null;

  const submittedMs = new Date(input.submittedAt).getTime();
  const queueMs = Math.max(0, genStart - submittedMs);

  // 火山生成中 updated_at 不前进，无法用其拆分：Generate 走墙钟（仍在生成，持续增长），
  // Poll Δ = 我方轮询延迟（now − 最近一次 poll），正常 ≈ 轮询间隔，停摆才增大。
  const generateMs = Math.max(0, input.nowMs - genStart);
  const lastPolled = trace.lastPolledAtMs;
  const pollDelayMs =
    lastPolled != null ? Math.max(0, input.nowMs - lastPolled) : 0;

  return {
    queueMs,
    generateMs,
    pollDelayMs,
    totalMs: queueMs + generateMs + pollDelayMs,
  };
}
