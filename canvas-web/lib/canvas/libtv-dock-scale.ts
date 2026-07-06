/**
 * LibTV 浮动输入坞 · 固定 flow 尺寸 + 固定屏幕尺寸（跨 zoom 恒定）。
 *
 * 目标（未展开 · 在原 656×212 基础上整体 +20%）：
 * - Dock 屏幕宽高：787 × 254
 * - 顶栏缩略图：118 × 118
 * - Dock 底栏 / 模式 chip 文字：27px
 * - 顶栏风格/标记按钮：70 × 70
 *
 * 通过 viewport 内 inverse-scale 抵消画布 zoom，实现 10%~800% 基本恒定。
 */

/** 全局统一放大系数：所有 Dock 在原基准上 +20% */
export const LIBTV_DOCK_UI_SCALE = 1.2;

export const LIBTV_DOCK_ASPECT_W = 656;
export const LIBTV_DOCK_ASPECT_H = 212;

/** flow 长宽同比 -10%（相对设计宽 1440） */
export const LIBTV_DOCK_SIZE_FACTOR = 0.9;

const LIBTV_DOCK_FLOW_WIDTH_DESIGN = 1440;

/** flow 坐标基准宽（100% zoom · 未展开） */
export const LIBTV_DOCK_FLOW_WIDTH = Math.round(
  LIBTV_DOCK_FLOW_WIDTH_DESIGN * LIBTV_DOCK_SIZE_FACTOR,
);

export function libtvDockHeightForWidth(flowWidth: number): number {
  return Math.round((flowWidth * LIBTV_DOCK_ASPECT_H) / LIBTV_DOCK_ASPECT_W);
}

export const LIBTV_DOCK_FLOW_HEIGHT = libtvDockHeightForWidth(
  LIBTV_DOCK_FLOW_WIDTH,
);

/** 未展开时屏幕倍率（固定尺寸模式下保持 1） */
export const LIBTV_DOCK_BASE_SCALE = 1;

/** 点击展开：仅增高 prompt 输入区（顶栏缩略图 / 字号不变） */
export const LIBTV_DOCK_EXPAND_FACTOR = 1.5;

export function libtvDockFlowSize(_expanded?: boolean): {
  w: number;
  h: number;
} {
  return { w: LIBTV_DOCK_FLOW_WIDTH, h: LIBTV_DOCK_FLOW_HEIGHT };
}

/** @deprecated 展开不再放大屏宽；保留恒为 1 */
export function libtvDockScreenExpandMultiplier(_expanded?: boolean): number {
  return 1;
}

/** 展开态 flow 高度（仅增高中间输入区 · 顶/底栏 flow 尺寸不变） */
export function libtvDockExpandedFlowHeight(
  baseFlowHeight: number,
  expanded = false,
): number {
  const h = Math.max(1, baseFlowHeight);
  return expanded ? Math.round(h * LIBTV_DOCK_EXPAND_FACTOR) : h;
}

/** Dock 未展开时固定屏幕宽度（css px · 656×1.2） */
export const LIBTV_DOCK_SCREEN_W_BASE = Math.round(656 * LIBTV_DOCK_UI_SCALE);
/** 保留同名常量用于兼容旧调用 */
export const LIBTV_DOCK_SCREEN_W_MIN = LIBTV_DOCK_SCREEN_W_BASE;
/** 保留同名常量用于兼容旧调用 */
export const LIBTV_DOCK_SCREEN_W_MAX = LIBTV_DOCK_SCREEN_W_BASE;

/** 画布缩小到 20% 时，Dock 内文字/缩略图相对现网再放大 3 倍（仅内容 · 外壳尺寸不变） */
export const LIBTV_DOCK_ZOOMOUT_CONTENT_BOOST_AT_MIN = 3;
export const LIBTV_DOCK_ZOOMOUT_BOOST_ANCHOR = 0.2;

/**
 * zoom≥1 为 1；zoom≤0.2 为 3；其间线性插值。
 * 使画布缩到 20% 时 Dock 内文字与缩略图仍可读。
 */
export function libtvDockZoomOutContentBoost(zoom: number): number {
  void zoom;
  return 1;
}

/**
 * Dock 内层内容 zoom（CSS zoom · 外壳 invScale 不变）。
 * - zoom≥1：补偿外壳缩小，使文字/缩略图屏上尺寸≈ zoom=1 基准。
 * - zoom<1：叠加 libtvDockZoomOutContentBoost。
 */
export function libtvDockInnerContentZoom(
  zoom: number,
  expanded = false,
): number {
  void zoom;
  void expanded;
  return 1;
}

/** 抵消外壳缩放，使 Dock 内元素屏上 px 恒定（flow 坐标用） */
export function libtvDockFixedFlowPx(
  targetScreenPx: number,
  shellScreenScale: number,
): number {
  const s = Math.max(0.08, Number.isFinite(shellScreenScale) ? shellScreenScale : 1);
  return targetScreenPx / s;
}

/** @deprecated 正文区请用 contentZoom；底栏请用 libtvDockFixedFlowPx */
export function libtvDockFixedScreenPx(
  basePx: number,
  contentZoom: number,
): number {
  const cz = Math.max(0.08, Number.isFinite(contentZoom) ? contentZoom : 1);
  return basePx / cz;
}

/**
 * 目标屏宽（固定）：默认 656px（展开不改变宽度）。
 */
export function computeLibtvDockScreenWidth(_zoom: number, _expanded = false): number {
  return LIBTV_DOCK_SCREEN_W_BASE;
}

/**
 * 挂在 RF viewport 内：屏幕宽 ≈ flowW × zoom × invScale。
 * 令 invScale = targetScreenW / (flowW × zoom)。
 */
export function computeLibtvDockInverseScale(
  zoom: number,
  flowWidth: number,
  _expanded = false,
): number {
  const z = Math.max(0.08, Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  const fw = Math.max(1, flowWidth);
  const target = computeLibtvDockScreenWidth(zoom);
  const inv = target / (fw * z);
  // 覆盖 10%~800%：zoom=0.1 时允许 >5；zoom=8 时允许 <0.1。
  return Math.min(12, Math.max(0.03, inv));
}

/** Dock 顶栏 · 上游参考缩略图（屏 px · 统一 118×118） */
export const DOCK_REF_THUMB_SCREEN_SIZE = 118;

/** @deprecated 用 DOCK_REF_THUMB_SCREEN_SIZE */
export const VIDEO_DOCK_HEADER_THUMB_SCREEN_AT_100 = DOCK_REF_THUMB_SCREEN_SIZE;

/** 固定 1:1 缩略图（屏 px） */
export const VIDEO_DOCK_HEADER_THUMB_W_MAX = DOCK_REF_THUMB_SCREEN_SIZE;
export const VIDEO_DOCK_HEADER_THUMB_H_MAX = DOCK_REF_THUMB_SCREEN_SIZE;

/** Dock 顶栏 · 标记按钮（屏 px · 宽 118；高与缩略图同行 118，避免顶栏吃光 prompt 区） */
export const DOCK_HEADER_MARK_BTN_SCREEN_W = 118;
export const DOCK_HEADER_MARK_BTN_SCREEN_H = 118;

/** 参考缩略图右上角序号角标（屏 px · 2× 基准） */
export const DOCK_REF_CORNER_BADGE_FONT_SCREEN = 24;
export const DOCK_REF_CORNER_BADGE_MIN_SCREEN = 32;

/** 模式 chip 固定字号（屏 px） */
export const VIDEO_DOCK_HEADER_CHIP_FONT_AT_100 = 27;

/** 模式 chip 最小屏高（配合 27px 字号） */
export const VIDEO_DOCK_HEADER_CHIP_MIN_HEIGHT_AT_100 = 52;

/** 视频 / 图片 Dock 底栏 · 模型名 / 积分字号（屏 px） */
export const VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100 = 27;

/** Dock 顶栏 · 风格 / 标记 / 上传方形按钮（屏 px） */
export const DOCK_HEADER_ACTION_BTN_SCREEN_AT_100 = 70;

/** 画布缩小锚点 · 顶栏缩略图仍保持 2×100% 基准 */
export const VIDEO_DOCK_HEADER_ZOOMOUT_ANCHOR = 0.15;

/** 画布放大锚点 · 顶栏相对 100% 再 ×2 */
export const VIDEO_DOCK_HEADER_ZOOMIN_ANCHOR = 2;

/** Dock 正文 prompt · 固定屏字号（14×1.2≈17） */
export const DOCK_PROMPT_FONT_SCREEN_AT_100 = Math.round(14 * LIBTV_DOCK_UI_SCALE);

/**
 * Dock 正文 prompt 屏上字号 · 随画布 zoom。
 * - 放大至 max：比 100% 基准小 2px
 * - 缩小至 min：比 max 再小 1px（max 与 min 仅差 1 个字号）
 */
export function libtvDockPromptFontScreenMetrics(canvasZoom: number): number {
  void canvasZoom;
  return DOCK_PROMPT_FONT_SCREEN_AT_100;
}

/** 正文在 contentZoom 包裹内 · flow 字号使屏上尺寸 = targetScreenPx */
export function libtvDockPromptFlowFontPx(
  targetScreenPx: number,
  shellScreenScale: number,
  contentZoom: number,
): number {
  const s = Math.max(0.08, Number.isFinite(shellScreenScale) ? shellScreenScale : 1);
  const cz = Math.max(0.08, Number.isFinite(contentZoom) ? contentZoom : 1);
  return targetScreenPx / (s * cz);
}

/**
 * 视频 / 图片 Dock 顶两栏（模式 chip + 缩略图）屏上尺寸固定。
 */
export function libtvDockVideoHeaderScreenMetrics(canvasZoom: number): {
  /** = thumbWidthScreenPx，向后兼容 */
  thumbScreenPx: number;
  thumbWidthScreenPx: number;
  thumbHeightScreenPx: number;
  chipFontScreenPx: number;
  badgeFontScreenPx: number;
} {
  void canvasZoom;
  const thumbWidthScreenPx = VIDEO_DOCK_HEADER_THUMB_W_MAX;
  const thumbHeightScreenPx = VIDEO_DOCK_HEADER_THUMB_H_MAX;
  const chipFontScreenPx = VIDEO_DOCK_HEADER_CHIP_FONT_AT_100;
  const badgeFontScreenPx = DOCK_REF_CORNER_BADGE_FONT_SCREEN;

  return {
    thumbScreenPx: thumbWidthScreenPx,
    thumbWidthScreenPx,
    thumbHeightScreenPx,
    chipFontScreenPx,
    badgeFontScreenPx,
  };
}
