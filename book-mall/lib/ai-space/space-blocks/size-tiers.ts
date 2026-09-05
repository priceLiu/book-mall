/**
 * 作品墙自由画布 · 五种固定尺寸档位
 *
 * 设计见 doc/product/AI 空间功能设计文档.md §3。
 * 画布为 12 列栅格，不提供自由 resize 手柄——块尺寸只能在下列档位间切换，
 * 以保证窄屏可降级、块永远对齐。
 */

export const SPACE_GRID_COLS = 12;
/** 单行高度（px），与 gap 一起决定块的真实像素尺寸 */
export const SPACE_GRID_ROW_HEIGHT = 72;
export const SPACE_GRID_GAP = 16;

export const SPACE_SIZE_TIER_KEYS = [
  "sm",
  "portrait",
  "wide",
  "lg",
  "full",
] as const;

export type SpaceSizeTierKey = (typeof SPACE_SIZE_TIER_KEYS)[number];

export type SpaceSizeTier = {
  key: SpaceSizeTierKey;
  label: string;
  /** 栅格列数（1..12） */
  w: number;
  /** 栅格行数 */
  h: number;
  hint: string;
};

export const SPACE_SIZE_TIERS: Record<SpaceSizeTierKey, SpaceSizeTier> = {
  sm: { key: "sm", label: "小方", w: 3, h: 3, hint: "缩略卡、按钮、分隔线" },
  portrait: {
    key: "portrait",
    label: "竖幅",
    w: 3,
    h: 6,
    hint: "竖图、数字人形象、竖版短视频",
  },
  wide: { key: "wide", label: "宽条", w: 6, h: 3, hint: "文字、名片、音频" },
  lg: { key: "lg", label: "大方", w: 6, h: 6, hint: "主视觉图 / 视频" },
  full: {
    key: "full",
    label: "通栏",
    w: 12,
    h: 6,
    hint: "图片墙、前后对比、封面",
  },
};

export const SPACE_SIZE_TIER_LIST: SpaceSizeTier[] = SPACE_SIZE_TIER_KEYS.map(
  (k) => SPACE_SIZE_TIERS[k],
);

export function isSpaceSizeTierKey(v: unknown): v is SpaceSizeTierKey {
  return (
    typeof v === "string" &&
    (SPACE_SIZE_TIER_KEYS as readonly string[]).includes(v)
  );
}

export function normalizeSpaceSizeTier(v: unknown): SpaceSizeTierKey {
  return isSpaceSizeTierKey(v) ? v : "lg";
}

/**
 * 档位 → 栅格宽高。`maxH` 用于标题/分隔线这类「档位只控宽度」的挂件，
 * 避免选了通栏就撑出 6 行高的空白。
 */
export function resolveTierLayout(
  tier: SpaceSizeTierKey,
  maxH?: number,
): { w: number; h: number } {
  const t = SPACE_SIZE_TIERS[tier];
  return { w: t.w, h: maxH ? Math.min(t.h, maxH) : t.h };
}
