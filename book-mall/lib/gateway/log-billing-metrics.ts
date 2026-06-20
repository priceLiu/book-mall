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

/** 视频：从 inputSummary 解析用户选择时长，封顶 15s；缺省 15s。 */
export function resolveBillableVideoSecondsFromLog(log: {
  requestKind?: string | null;
  inputSummary?: unknown;
}): number {
  if (log.requestKind !== "VIDEO") return 1;
  const hints = parseVideoPricingHints(log.inputSummary);
  return videoBillableSeconds(hints.durationSec);
}
