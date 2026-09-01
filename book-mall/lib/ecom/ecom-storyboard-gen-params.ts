/** 万相文生图尺寸（与 DashScope parameters.size 一致） */
import { ecomRatioToImageSize, type EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";

export const ECOM_STORYBOARD_WANX_SIZES = [
  "720*1280",
  "1280*720",
  "1024*1024",
] as const;

export type EcomStoryboardWanxSize = (typeof ECOM_STORYBOARD_WANX_SIZES)[number];

export type EcomStoryboardVideoResolution = "720p" | "1080p";

/** 万相 2.7 多图参考 API 的 size 参数（UI 像素 → 厂商 size） */
export function resolveWan27ImageSize(opts: {
  aspectRatio?: "16:9" | "9:16";
  imageSize?: string;
}): string {
  const raw = opts.imageSize?.trim();
  const map: Record<string, string> = {
    "1280*720": "1696*960",
    "1440*810": "1696*960",
    "1920*1080": "1696*960",
    "2048*1152": "1696*960",
    "1664*928": "1696*960",
    "1024*1024": "1280*1280",
    "1440*1440": "1280*1280",
    "1536*1536": "1280*1280",
    "2048*2048": "1280*1280",
    "720*1280": "960*1696",
    "1080*1920": "960*1696",
    "1152*2048": "960*1696",
    "928*1664": "960*1696",
  };
  if (raw && map[raw]) return map[raw]!;
  if (raw?.includes("*")) return raw;
  return opts.aspectRatio === "16:9" ? "1696*960" : "960*1696";
}

/** 可灵 3.0 图像分辨率参数 */
export function resolveKlingV3Resolution(opts?: {
  imageSize?: string;
}): "1k" | "2k" {
  const v = opts?.imageSize?.trim().toLowerCase();
  if (v === "1k") return "1k";
  return "2k";
}

/** 万相 2.6-image 分辨率档位（非像素 size） */
export function resolveWan26ImageSize(_opts?: {
  imageSize?: string;
}): "1K" | "2K" {
  return "2K";
}

/** 与 canvas dispatch-canvas-image 一致：wan2.7 有参考图时不传 pixel size，由 API 默认 2K */
export function resolveStoryboardWan27JobSize(opts: {
  wan26: boolean;
  refCount: number;
  wan27Size: string;
}): string | undefined {
  if (opts.wan26) return resolveWan26ImageSize();
  if (opts.refCount > 0) return undefined;
  return opts.wan27Size;
}

export function resolveWanxImageSize(opts: {
  aspectRatio?: "16:9" | "9:16";
  imageSize?: string;
}): EcomStoryboardWanxSize {
  const raw = opts.imageSize?.trim();
  if (raw && raw.includes("*")) {
    return raw as EcomStoryboardWanxSize;
  }
  if (raw && (ECOM_STORYBOARD_WANX_SIZES as readonly string[]).includes(raw)) {
    return raw as EcomStoryboardWanxSize;
  }
  return opts.aspectRatio === "16:9" ? "1280*720" : "720*1280";
}

/** 统一生图链路：模型 + 比例 + 可选像素尺寸 → 下发厂商 size */
export function resolveEcomGeneratePixelSize(opts: {
  modelKey: string;
  ratio: EcomImageRatio;
  imageSize?: string;
}): string {
  const raw = opts.imageSize?.trim();
  const aspectRatio: "16:9" | "9:16" =
    opts.ratio === "16:9" ? "16:9" : "9:16";
  if (raw === "2K" || raw === "4K") return raw;
  if (raw?.includes("*")) {
    if (/wan2\.[67]-image/i.test(opts.modelKey)) {
      return resolveWan27ImageSize({ aspectRatio, imageSize: raw });
    }
    return raw;
  }
  if (/wan2\.[67]-image/i.test(opts.modelKey)) {
    return resolveWan27ImageSize({ aspectRatio, imageSize: raw });
  }
  return ecomRatioToImageSize(opts.ratio);
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

/** 弹层「生成配音/音效」默认值；用户显式传参时优先 */
export function resolveEcomVideoGenerateAudio(
  modelKey: string,
  override?: boolean,
): boolean {
  if (typeof override === "boolean") return override;
  const k = modelKey.trim().toLowerCase();
  if (k.includes("bytedance/seedance") || /doubao-seedance/i.test(k)) return true;
  if (/kling.*3\.0/i.test(k) || /seedance-1\.5/i.test(k)) return true;
  return false;
}

/** 根据各镜 durationHintSec 推算时间轴文案 */
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

export function buildPanelTimelineLabel(
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
