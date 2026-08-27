/** 烧录字幕样式 · 全站统一枚举（画布 / 电商 / AI 空间 / Media Render） */

export const SUBTITLE_FONT_KEYS = ["heiti", "songti", "noto"] as const;
export type SubtitleFontKey = (typeof SUBTITLE_FONT_KEYS)[number];

export const SUBTITLE_SIZE_KEYS = ["large", "medium", "small"] as const;
export type SubtitleSizeKey = (typeof SUBTITLE_SIZE_KEYS)[number];

export type SubtitleBurnInStyle = {
  fontKey: SubtitleFontKey;
  /** 兼容旧配置；未设 fontSize 时用作回退 */
  sizeKey: SubtitleSizeKey;
  /** ASS 脚本 FontSize（PlayResY=288）；优先于 sizeKey */
  fontSize?: number;
};

/** 与 libass 默认视觉对齐：大 = 历史默认烧录效果 */
export const DEFAULT_SUBTITLE_STYLE: SubtitleBurnInStyle = {
  fontKey: "heiti",
  sizeKey: "large",
  fontSize: 14,
};

export const SUBTITLE_FONT_SIZE_MIN = 6;
export const SUBTITLE_FONT_SIZE_MAX = 36;

export const SUBTITLE_FONT_OPTIONS: ReadonlyArray<{
  value: SubtitleFontKey;
  label: string;
}> = [
  { value: "heiti", label: "黑体" },
  { value: "songti", label: "宋体" },
  { value: "noto", label: "思源黑体" },
];

export const SUBTITLE_SIZE_OPTIONS: ReadonlyArray<{
  value: SubtitleSizeKey;
  label: string;
}> = [
  { value: "large", label: "大" },
  { value: "medium", label: "中" },
  { value: "small", label: "小" },
];

/** ASS FontSize（PlayResY=288 脚本坐标） */
export const SUBTITLE_ASS_FONT_SIZE: Record<SubtitleSizeKey, number> = {
  large: 20,
  medium: 16,
  small: 13,
};

export function isSubtitleFontKey(v: unknown): v is SubtitleFontKey {
  return (
    typeof v === "string" &&
    (SUBTITLE_FONT_KEYS as readonly string[]).includes(v)
  );
}

export function isSubtitleSizeKey(v: unknown): v is SubtitleSizeKey {
  return (
    typeof v === "string" &&
    (SUBTITLE_SIZE_KEYS as readonly string[]).includes(v)
  );
}

function clampSubtitleFontSize(n: number): number {
  const rounded = Math.round(n);
  return Math.min(
    SUBTITLE_FONT_SIZE_MAX,
    Math.max(SUBTITLE_FONT_SIZE_MIN, rounded),
  );
}

/** 解析最终 ASS FontSize：fontSize 优先，否则回退 sizeKey 映射 */
export function resolveSubtitleAssFontSize(
  style: SubtitleBurnInStyle,
): number {
  if (
    typeof style.fontSize === "number" &&
    Number.isFinite(style.fontSize)
  ) {
    return clampSubtitleFontSize(style.fontSize);
  }
  return SUBTITLE_ASS_FONT_SIZE[style.sizeKey];
}

export function normalizeSubtitleBurnInStyle(
  raw?: Partial<SubtitleBurnInStyle> | null,
): SubtitleBurnInStyle {
  const fontKey = isSubtitleFontKey(raw?.fontKey)
    ? raw.fontKey
    : DEFAULT_SUBTITLE_STYLE.fontKey;
  const sizeKey = isSubtitleSizeKey(raw?.sizeKey)
    ? raw.sizeKey
    : DEFAULT_SUBTITLE_STYLE.sizeKey;
  const out: SubtitleBurnInStyle = { fontKey, sizeKey };
  if (
    typeof raw?.fontSize === "number" &&
    Number.isFinite(raw.fontSize)
  ) {
    out.fontSize = clampSubtitleFontSize(raw.fontSize);
  }
  return out;
}
