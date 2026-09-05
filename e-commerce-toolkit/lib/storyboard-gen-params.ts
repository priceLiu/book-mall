export {
  STORYBOARD_WANX_SIZE_OPTIONS,
  type StoryboardWanxSize,
  imageSizeOptionsForModel,
  imagePickerUsesAspectRatioOnly,
  defaultImageSizeForModel,
  aspectRatioForImageSize,
  imageSizeToEcomRatio,
  filterImageSizeOptionsByEcomRatio,
} from "@/lib/storyboard-image-size-options";

import {
  defaultImageSizeForModel,
  aspectRatioForImageSize,
  type StoryboardWanxSize,
} from "@/lib/storyboard-image-size-options";

/** @deprecated 请用 defaultImageSizeForModel(modelKey, aspectRatio) */
export function defaultWanxSizeForAspect(aspectRatio: "16:9" | "9:16"): StoryboardWanxSize {
  return defaultImageSizeForModel("wan2.7-image", aspectRatio);
}

export function aspectRatioForWanxSize(size: string): "16:9" | "9:16" {
  const ar = aspectRatioForImageSize(size);
  return ar === "16:9" ? "16:9" : "9:16";
}

export const STORYBOARD_VIDEO_RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "2k", label: "2K" },
] as const;

export type StoryboardVideoResolution =
  (typeof STORYBOARD_VIDEO_RESOLUTION_OPTIONS)[number]["value"];

function normalizeTimelineLabel(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value) && value.length >= 2) return `${value[0]}-${value[1]}s`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const start = record.start ?? record.from;
    const end = record.end ?? record.to;
    if (start != null && end != null) return `${start}-${end}s`;
  }
  return String(value).trim();
}

export function buildPanelTimelineMap(
  panels: Array<{ index: number; timeline?: unknown; durationHintSec?: number }>,
  totalDurationHintSec?: number,
): Map<number, string> {
  const out = new Map<number, string>();
  let cursor = 0;
  const defaultPer =
    panels.length > 0
      ? Math.max(
          1,
          Math.round((totalDurationHintSec ?? panels.length * 3) / panels.length),
        )
      : 3;

  for (const panel of panels) {
    const timeline = normalizeTimelineLabel(panel.timeline);
    if (timeline) {
      out.set(panel.index, timeline);
      const match = timeline.match(/(\d+)\s*[-–~]\s*(\d+)/);
      cursor = match ? Number(match[2]) : cursor + (panel.durationHintSec ?? defaultPer);
      continue;
    }
    const dur = panel.durationHintSec ?? defaultPer;
    const end = cursor + dur;
    out.set(panel.index, `${cursor}–${end}s`);
    cursor = end;
  }
  return out;
}
