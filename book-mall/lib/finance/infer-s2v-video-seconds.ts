/**
 * wan2.2-s2v 成片秒数推断（对账 / AR-105 回填）。
 */
import {
  parseOutputVideoSecondsFromResult,
  parseWan30OutputVideoSec,
} from "@/lib/gateway/log-billing-metrics";

const S2V_MODEL_KEYS = new Set(["wan2.2-s2v", "wan2.2-s2v-detect"]);

export function isS2vModelKey(model: string | null | undefined): boolean {
  const k = (model ?? "").trim().toLowerCase();
  return S2V_MODEL_KEYS.has(k) || k.includes("wan2.2-s2v");
}

function positiveNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function taskMetricsVideoSec(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const output = root.output;
  if (!output || typeof output !== "object") return null;
  const out = output as Record<string, unknown>;
  const metrics = out.task_metrics;
  if (!metrics || typeof metrics !== "object") return null;
  const m = metrics as Record<string, unknown>;
  return (
    positiveNum(m.VIDEO_DURATION) ??
    positiveNum(m.video_duration) ??
    positiveNum(m.output_video_duration)
  );
}

/** 从 Gateway 日志推断 S2V 计费秒数；无法推断时返回 null。 */
export function inferS2vVideoSecondsFromLog(log: {
  model?: string | null;
  canonicalModelKey?: string | null;
  requestKind?: string | null;
  inputSummary?: unknown;
  resultSummary?: unknown;
  audioDurationSecFallback?: number | null;
}): number | null {
  const modelKey = log.canonicalModelKey ?? log.model ?? "";
  if (!isS2vModelKey(modelKey)) return null;

  const fromResult =
    parseOutputVideoSecondsFromResult(log.resultSummary) ??
    parseWan30OutputVideoSec(log.resultSummary);
  if (fromResult != null && fromResult > 0) return Math.round(fromResult);

  const fromMetrics = taskMetricsVideoSec(log.resultSummary);
  if (fromMetrics != null && fromMetrics > 0) return Math.round(fromMetrics);

  if (log.audioDurationSecFallback != null && log.audioDurationSecFallback > 0) {
    return Math.round(log.audioDurationSecFallback);
  }

  return null;
}

/** 为 S2V 终态日志写入 usage.duration（便于对账聚合）。 */
export function mergeS2vDurationIntoResultSummary(
  resultSummary: unknown,
  durationSec: number,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    resultSummary && typeof resultSummary === "object" && !Array.isArray(resultSummary)
      ? { ...(resultSummary as Record<string, unknown>) }
      : {};
  const usage =
    base.usage && typeof base.usage === "object" && !Array.isArray(base.usage)
      ? { ...(base.usage as Record<string, unknown>) }
      : {};
  return {
    ...base,
    ...extra,
    durationSec: Math.round(durationSec),
    usage: {
      ...usage,
      duration: Math.round(durationSec),
      output_video_duration: Math.round(durationSec),
    },
  };
}
