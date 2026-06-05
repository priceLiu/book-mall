export const STORYBOARD_WANX_SIZE_OPTIONS = [
  { value: "720*1280", label: "720×1280（9:16 竖屏）", aspectRatio: "9:16" as const },
  { value: "1280*720", label: "1280×720（16:9 横屏）", aspectRatio: "16:9" as const },
  { value: "1024*1024", label: "1024×1024（1:1）", aspectRatio: "9:16" as const },
];

export const STORYBOARD_VIDEO_RESOLUTION_OPTIONS = [
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
] as const;

export type StoryboardWanxSize = (typeof STORYBOARD_WANX_SIZE_OPTIONS)[number]["value"];
export type StoryboardVideoResolution =
  (typeof STORYBOARD_VIDEO_RESOLUTION_OPTIONS)[number]["value"];

export function defaultWanxSizeForAspect(aspectRatio: "16:9" | "9:16"): StoryboardWanxSize {
  return aspectRatio === "16:9" ? "1280*720" : "720*1280";
}

export function aspectRatioForWanxSize(size: string): "16:9" | "9:16" {
  if (size === "1280*720") return "16:9";
  return "9:16";
}

export function buildPanelTimelineMap(
  panels: Array<{ index: number; timeline?: string; durationHintSec?: number }>,
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
    if (panel.timeline?.trim()) {
      out.set(panel.index, panel.timeline.trim());
      const match = panel.timeline.match(/(\d+)\s*[-–~]\s*(\d+)/);
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
