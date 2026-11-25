import type { EcomCopyOverlayLayer } from "./types";

export type EcomCopyFontPresetId =
  | "system"
  | "pingfang"
  | "heiti"
  | "yahei"
  | "hiragino"
  | "yuanti"
  | "songti"
  | "kaiti"
  | "fangsong"
  | "lishu"
  | "xingkai"
  | "weibei"
  | "wawati"
  | "hand"
  | "baoli"
  | "arial"
  | "georgia"
  | "times"
  | "impact"
  | "mono";

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
  {
    id: "pingfang",
    label: "苹方",
    css: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    svg: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  {
    id: "hiragino",
    label: "冬青黑体",
    css: '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", sans-serif',
    svg: '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    id: "yuanti",
    label: "圆体",
    css: '"Yuanti SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    svg: '"Yuanti SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    id: "lishu",
    label: "隶书",
    css: '"Baoli SC", "Libian SC", "STLiti", "KaiTi", serif',
    svg: '"Baoli SC", "Libian SC", "STLiti", "KaiTi", serif',
  },
  {
    id: "xingkai",
    label: "行楷",
    css: '"Xingkai SC", "STXingkai", "KaiTi", cursive',
    svg: '"Xingkai SC", "STXingkai", "KaiTi", cursive',
  },
  {
    id: "weibei",
    label: "魏碑",
    css: '"Weibei SC", "STXinwei", "KaiTi", serif',
    svg: '"Weibei SC", "STXinwei", "KaiTi", serif',
  },
  {
    id: "wawati",
    label: "娃娃体",
    css: '"Wawati SC", "Wawati TC", "PingFang SC", cursive',
    svg: '"Wawati SC", "Wawati TC", "PingFang SC", cursive',
  },
  {
    id: "hand",
    label: "手写",
    css: '"Hannotate SC", "HanziPen SC", "STXingkai", cursive',
    svg: '"Hannotate SC", "HanziPen SC", "STXingkai", cursive',
  },
  {
    id: "baoli",
    label: "报隶",
    css: '"Baoli SC", "STBaoli", "KaiTi", serif',
    svg: '"Baoli SC", "STBaoli", "KaiTi", serif',
  },
  {
    id: "arial",
    label: "Arial",
    css: "Arial, Helvetica, sans-serif",
    svg: "Arial, Helvetica, sans-serif",
  },
  {
    id: "georgia",
    label: "Georgia",
    css: "Georgia, 'Songti SC', serif",
    svg: "Georgia, 'Songti SC', serif",
  },
  {
    id: "times",
    label: "Times",
    css: '"Times New Roman", Times, "Songti SC", serif',
    svg: '"Times New Roman", Times, "Songti SC", serif',
  },
  {
    id: "impact",
    label: "Impact",
    css: "Impact, Haettenschweiler, 'Arial Black', sans-serif",
    svg: "Impact, Haettenschweiler, 'Arial Black', sans-serif",
  },
  {
    id: "mono",
    label: "等宽",
    css: '"SF Mono", Menlo, Consolas, monospace',
    svg: '"SF Mono", Menlo, Consolas, monospace',
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
