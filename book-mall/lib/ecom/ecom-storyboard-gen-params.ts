/** 万相文生图尺寸（与 DashScope parameters.size 一致） */
export const ECOM_STORYBOARD_WANX_SIZES = [
  "720*1280",
  "1280*720",
  "1024*1024",
] as const;

export type EcomStoryboardWanxSize = (typeof ECOM_STORYBOARD_WANX_SIZES)[number];

export type EcomStoryboardVideoResolution = "720p" | "1080p";

/** 万相 2.7 多图参考 API 的 size 参数 */
export function resolveWan27ImageSize(opts: {
  aspectRatio?: "16:9" | "9:16";
  imageSize?: string;
}): string {
  const raw = opts.imageSize?.trim();
  if (raw === "1280*720") return "1696*960";
  if (raw === "1024*1024") return "1280*1280";
  if (raw === "720*1280") return "960*1696";
  return opts.aspectRatio === "16:9" ? "1696*960" : "960*1696";
}

/** 可灵 3.0 图像分辨率参数 */
export function resolveKlingV3Resolution(_opts?: {
  imageSize?: string;
}): "1k" | "2k" {
  return "2k";
}

/** 万相 2.6-image 分辨率档位（非像素 size） */
export function resolveWan26ImageSize(_opts?: {
  imageSize?: string;
}): "1K" | "2K" {
  return "2K";
}

export function resolveWanxImageSize(opts: {
  aspectRatio?: "16:9" | "9:16";
  imageSize?: string;
}): EcomStoryboardWanxSize {
  const raw = opts.imageSize?.trim();
  if (raw && (ECOM_STORYBOARD_WANX_SIZES as readonly string[]).includes(raw)) {
    return raw as EcomStoryboardWanxSize;
  }
  return opts.aspectRatio === "16:9" ? "1280*720" : "720*1280";
}

export function resolveVideoResolution(raw?: string): EcomStoryboardVideoResolution {
  const v = raw?.trim().toLowerCase();
  return v === "720p" ? "720p" : "1080p";
}

export function videoSrFromResolution(resolution: EcomStoryboardVideoResolution): number {
  return resolution === "720p" ? 720 : 1080;
}

export function bailianResolutionFromEcom(
  resolution: EcomStoryboardVideoResolution,
): "720P" | "1080P" {
  return resolution === "720p" ? "720P" : "1080P";
}

/** 根据各镜 durationHintSec 推算时间轴文案 */
export function buildPanelTimelineLabel(
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
      if (match) {
        cursor = Number(match[2]);
      } else {
        const dur = panel.durationHintSec ?? defaultPer;
        cursor += dur;
      }
      continue;
    }
    const dur = panel.durationHintSec ?? defaultPer;
    const end = cursor + dur;
    out.set(panel.index, `${cursor}–${end}s`);
    cursor = end;
  }
  return out;
}
