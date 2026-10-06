/** 本地 ffmpeg 裁剪/去原音等 · 成片在 runtime/ossUrl，不应被 Gateway 任务 URL 覆盖 */
export function hasSbv1LocalVideoEditResult(data: {
  label?: string;
  trimClipMeta?: { durationSec?: number; startSec?: number; endSec?: number };
}): boolean {
  const d = data.trimClipMeta?.durationSec;
  if (typeof d === "number" && Number.isFinite(d) && d > 0) {
    return true;
  }
  const label = data.label?.trim() ?? "";
  return (
    label.startsWith("剪辑片段") ||
    label.startsWith("裁剪片段") ||
    label === "去原音"
  );
}

export function pickSbv1LocalEditedVideoUrl(data: {
  ossUrl?: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string; status?: string; taskId?: string };
  label?: string;
  trimClipMeta?: { durationSec?: number };
}): string | undefined {
  const url =
    data.runtime?.ossUrl?.trim() ||
    data.runtime?.ephemeralUrl?.trim() ||
    data.ossUrl?.trim() ||
    "";
  if (!url) return undefined;
  if (hasSbv1LocalVideoEditResult(data)) return url;
  if (data.runtime?.status === "done" && !data.runtime?.taskId?.trim()) {
    return url;
  }
  return undefined;
}
