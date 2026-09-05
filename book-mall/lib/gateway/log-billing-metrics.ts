import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";
import { videoBillableSeconds } from "@/lib/pricing/credit-pricing-formulas";

/** Gateway 日志 → 财务结算用量（张/秒/token） */

function inputRecord(inputSummary: unknown): Record<string, unknown> | null {
  if (!inputSummary || typeof inputSummary !== "object" || Array.isArray(inputSummary)) {
    return null;
  }
  const input = (inputSummary as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function positiveInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.round(v);
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

/** 从 inputSummary 解析显式 imageCount（image-parsing / 试衣等）。 */
export function imageCountFromInputSummary(inputSummary: unknown): number | null {
  const input = inputRecord(inputSummary);
  if (!input) return null;
  return (
    positiveInt(input.imageCount) ??
    positiveInt(input.image_count) ??
    positiveInt(input.inputImageCount)
  );
}

/** 试衣/生图：按输入参考图张数；缺省 1 张（含 aitryon-parsing 单图分割）。 */
export function resolveBillableImageCountFromLog(log: {
  requestKind?: string | null;
  inputSummary?: unknown;
}): number {
  const explicit = imageCountFromInputSummary(log.inputSummary);
  if (explicit != null) return explicit;

  const input = inputRecord(log.inputSummary);
  if (!input) return 1;

  if (log.requestKind === "TRYON") {
    const hasImage =
      typeof input.imageUrl === "string" ||
      typeof input.image_url === "string" ||
      typeof input.personImageUrl === "string" ||
      typeof input.person_image_url === "string";
    if (hasImage) return 1;
  }

  const refUrls = input.referenceImageUrls ?? input.reference_image_urls;
  if (Array.isArray(refUrls)) {
    const n = refUrls.filter((u) => typeof u === "string" && u.trim()).length;
    if (n > 0) return n;
  }

  const n = positiveInt(input.n);
  if (n != null && (log.requestKind === "IMAGE" || log.requestKind === "TRYON")) {
    return n;
  }

  return 1;
}

function positiveNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** 从 resultSummary 解析成片时长（优先于请求参数时长）。 */
export function parseOutputVideoSecondsFromResult(resultSummary: unknown): number | null {
  const fromWan = parseWan30OutputVideoSec(resultSummary);
  if (fromWan != null) return fromWan;
  const result = resultRecord(resultSummary);
  if (!result) return null;
  const usage = result.usage;
  if (usage && typeof usage === "object" && !Array.isArray(usage)) {
    const u = usage as Record<string, unknown>;
    const fromOutput =
      positiveNum(u.output_video_duration) ??
      positiveNum(u.outputVideoDuration) ??
      positiveNum(u.output_duration);
    if (fromOutput != null) return Math.round(fromOutput);
    const fromDur = positiveNum(u.duration);
    if (fromDur != null) return Math.round(fromDur);
  }
  return null;
}

/** 视频：优先 resultSummary 成片秒数，否则 input 请求时长，封顶 15s；缺省 15s。 */
export function resolveBillableVideoSecondsFromLog(log: {
  requestKind?: string | null;
  inputSummary?: unknown;
  resultSummary?: unknown;
}): number {
  if (log.requestKind !== "VIDEO") return 1;
  const outputSec = parseOutputVideoSecondsFromResult(log.resultSummary);
  if (outputSec != null) return videoBillableSeconds(outputSec);
  const hints = parseVideoPricingHints(log.inputSummary);
  return videoBillableSeconds(hints.durationSec);
}

function resultRecord(resultSummary: unknown): Record<string, unknown> | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  return resultSummary as Record<string, unknown>;
}

/** ASR：从 resultSummary.audioDurationSec 或 input 解析音频秒数。 */
export function resolveBillableAudioSecondsFromLog(
  log: { model?: string | null; inputSummary?: unknown },
  resultSummary?: unknown,
): number | null {
  const model = (log.model ?? "").trim().toLowerCase();
  if (!model.includes("asr") && !model.includes("qwen3-asr")) {
    const input = inputRecord(log.inputSummary);
    const canonical = typeof input?.canonicalModelKey === "string" ? input.canonicalModelKey : "";
    if (!canonical.includes("asr")) return null;
  }
  const result = resultRecord(resultSummary);
  const fromSource = positiveInt(result?.sourceAudioDurationSec);
  if (fromSource != null) return fromSource;
  const fromResult = positiveInt(result?.audioDurationSec);
  if (fromResult != null) return fromResult;
  const usage = result?.usage;
  if (usage && typeof usage === "object" && !Array.isArray(usage)) {
    const fromUsage = positiveInt((usage as Record<string, unknown>).seconds);
    if (fromUsage != null) return fromUsage;
    const fromDur = positiveInt((usage as Record<string, unknown>).duration);
    if (fromDur != null) return fromDur;
  }
  const input = inputRecord(log.inputSummary);
  return positiveInt(input?.audioDurationSec) ?? positiveInt(input?.durationSec);
}

export function parseWan30InputVideoSec(inputSummary: unknown): number | null {
  const input = inputRecord(inputSummary);
  if (!input) return null;
  return (
    positiveInt(input.inputVideoSec) ??
    positiveInt(input.input_duration) ??
    positiveInt(input.inputDuration)
  );
}

export function parseWan30OutputVideoSec(resultSummary: unknown): number | null {
  const result = resultRecord(resultSummary);
  if (!result) return null;
  return (
    positiveInt(result.outputVideoSec) ??
    positiveInt(result.durationSec) ??
    positiveInt(result.videoDurationSec)
  );
}
