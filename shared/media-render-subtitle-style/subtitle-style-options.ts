/** 烧录字幕样式 · 全站统一枚举（画布 / 电商 / AI 空间 / Media Render） */

export const SUBTITLE_FONT_KEYS = ["heiti", "songti", "noto"] as const;
export type SubtitleFontKey = (typeof SUBTITLE_FONT_KEYS)[number];

export const SUBTITLE_SIZE_KEYS = ["large", "medium", "small"] as const;
export type SubtitleSizeKey = (typeof SUBTITLE_SIZE_KEYS)[number];

export type SubtitleBurnInStyle = {
  fontKey: SubtitleFontKey;
  sizeKey: SubtitleSizeKey;
};

/** 与 libass 默认视觉对齐：大 = 当前烧录效果 */
export const DEFAULT_SUBTITLE_STYLE: SubtitleBurnInStyle = {
  fontKey: "heiti",
  sizeKey: "large",
};

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

export function normalizeSubtitleBurnInStyle(
  raw?: Partial<SubtitleBurnInStyle> | null,
): SubtitleBurnInStyle {
  return {
    fontKey: isSubtitleFontKey(raw?.fontKey)
      ? raw.fontKey
      : DEFAULT_SUBTITLE_STYLE.fontKey,
    sizeKey: isSubtitleSizeKey(raw?.sizeKey)
      ? raw.sizeKey
      : DEFAULT_SUBTITLE_STYLE.sizeKey,
  };
}
