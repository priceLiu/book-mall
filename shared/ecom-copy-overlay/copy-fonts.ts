import type { EcomCopyOverlayLayer } from "./types";

export type EcomCopyFontPresetId =
  | "system"
  | "heiti"
  | "songti"
  | "kaiti"
  | "yahei"
  | "fangsong";

export type EcomCopyFontPreset = {
  id: EcomCopyFontPresetId;
  label: string;
  /** 浏览器预览 */
  css: string;
  /** SVG / sharp 合成 */
  svg: string;
};

export const ECOM_COPY_FONT_PRESETS: EcomCopyFontPreset[] = [
  {
    id: "system",
    label: "系统默认",
    css: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif",
    svg: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif",
  },
  {
    id: "heiti",
    label: "黑体",
    css: "SimHei, Heiti SC, PingFang SC, Microsoft YaHei, sans-serif",
    svg: "SimHei, Heiti SC, PingFang SC, Microsoft YaHei, sans-serif",
  },
  {
    id: "yahei",
    label: "微软雅黑",
    css: "Microsoft YaHei, PingFang SC, sans-serif",
    svg: "Microsoft YaHei, PingFang SC, sans-serif",
  },
  {
    id: "songti",
    label: "宋体",
    css: "SimSun, Songti SC, STSong, serif",
    svg: "SimSun, Songti SC, STSong, serif",
  },
  {
    id: "kaiti",
    label: "楷体",
    css: "KaiTi, Kaiti SC, STKaiti, serif",
    svg: "KaiTi, Kaiti SC, STKaiti, serif",
  },
  {
    id: "fangsong",
    label: "仿宋",
    css: "FangSong, STFangsong, serif",
    svg: "FangSong, STFangsong, serif",
  },
];

const presetById = new Map(ECOM_COPY_FONT_PRESETS.map((p) => [p.id, p]));

export function normalizeCopyFontPresetId(raw: unknown): EcomCopyFontPresetId {
  if (typeof raw === "string" && presetById.has(raw as EcomCopyFontPresetId)) {
    return raw as EcomCopyFontPresetId;
  }
  return "system";
}

export function resolveLayerFontCss(layer: EcomCopyOverlayLayer): string {
  const id = normalizeCopyFontPresetId(layer.fontFamily);
  return presetById.get(id)!.css;
}

export function resolveLayerFontSvg(layer: EcomCopyOverlayLayer): string {
  const id = normalizeCopyFontPresetId(layer.fontFamily);
  return presetById.get(id)!.svg;
}
