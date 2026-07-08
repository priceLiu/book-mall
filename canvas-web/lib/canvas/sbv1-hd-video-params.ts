/**
 * Topaz 高清视频 · Dock 参数与 API 映射
 * @see docs/topaz.md · filters.slowmo / duplicate / fps
 */

const TOPAZ_HD_MODEL_KEY = "topaz-labs/video-enhance";

export type TopazHdResolution = "1080p" | "2k" | "4k";
export type TopazFrameInterpolation = "none" | "high";
export type TopazSlowmo = 1 | 2 | 3 | 5;

export const TOPAZ_HD_RESOLUTION_OPTIONS: {
  id: TopazHdResolution;
  label: string;
}[] = [
  { id: "1080p", label: "1080P" },
  { id: "2k", label: "2K" },
  { id: "4k", label: "4K" },
];

export const TOPAZ_HD_FRAME_INTERPOLATION_OPTIONS: {
  id: TopazFrameInterpolation;
  label: string;
}[] = [
  { id: "none", label: "不补帧" },
  { id: "high", label: "高质量补帧" },
];

export const TOPAZ_HD_SLOWMO_OPTIONS: {
  id: TopazSlowmo;
  label: string;
}[] = [
  { id: 1, label: "1x" },
  { id: 2, label: "2x" },
  { id: 3, label: "3x" },
  { id: 5, label: "5x" },
];

export function isSbv1HdVideoNode(data: {
  creationType?: string;
  engine?: { modelKey?: string };
}): boolean {
  if (data.creationType === "hd-video") return true;
  const key = data.engine?.modelKey?.trim().toLowerCase() ?? "";
  return (
    key === TOPAZ_HD_MODEL_KEY ||
    key === "topaz/video-upscale"
  );
}

export function topazUpscaleFromResolution(res: TopazHdResolution): number {
  if (res === "4k") return 4;
  if (res === "2k") return 2;
  return 1;
}

export function parseTopazHdResolution(raw: unknown): TopazHdResolution {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "4k") return "4k";
  if (s === "2k") return "2k";
  return "1080p";
}

export function parseTopazFrameInterpolation(
  raw: unknown,
): TopazFrameInterpolation {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "high" || s === "high_quality" || s === "quality") return "high";
  return "none";
}

export function parseTopazSlowmo(raw: unknown): TopazSlowmo {
  const n =
    typeof raw === "number" ? raw : parseInt(String(raw ?? "1"), 10);
  if (n === 2 || n === 3 || n === 5) return n;
  return 1;
}

export function topazHdParamsTriggerLabel(data: {
  resolution?: string;
  engine?: { params?: Record<string, unknown> };
}): string {
  const res = parseTopazHdResolution(data.resolution);
  const params = data.engine?.params ?? {};
  const interp = parseTopazFrameInterpolation(
    params.frame_interpolation ?? params.frameInterpolation,
  );
  const slowmo = parseTopazSlowmo(params.slowmo);
  const resLabel =
    TOPAZ_HD_RESOLUTION_OPTIONS.find((o) => o.id === res)?.label ?? "1080P";
  const interpLabel =
    TOPAZ_HD_FRAME_INTERPOLATION_OPTIONS.find((o) => o.id === interp)?.label ??
    "不补帧";
  const slowLabel =
    TOPAZ_HD_SLOWMO_OPTIONS.find((o) => o.id === slowmo)?.label ?? "1x";
  return `${resLabel} · ${interpLabel} · ${slowLabel}`;
}
