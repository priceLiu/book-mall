/**
 * LibTV 浮动输入坞 · 固定 flow 尺寸 + 屏幕线性缩放。
 *
 * 比例 16:6 · SIZE_FACTOR 0.9（长宽同比 -10%）。
 * 未展开：屏幕基准 +40%（LIBTV_DOCK_BASE_SCALE）。
 * 展开态：在基准上再 +20%（LIBTV_DOCK_EXPAND_FACTOR）。
 */

export const LIBTV_DOCK_ASPECT_W = 16;
export const LIBTV_DOCK_ASPECT_H = 6;

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

/** 未展开时屏幕显示同比 +40%（flow 布局不变 · 内容随 invScale 放大） */
export const LIBTV_DOCK_BASE_SCALE = 1.4;

/** 点击展开：在基准上再 +20% */
export const LIBTV_DOCK_EXPAND_FACTOR = 1.2;

export function libtvDockFlowSize(_expanded?: boolean): {
  w: number;
  h: number;
} {
  return { w: LIBTV_DOCK_FLOW_WIDTH, h: LIBTV_DOCK_FLOW_HEIGHT };
}

export function libtvDockScreenExpandMultiplier(expanded: boolean): number {
  return expanded ? LIBTV_DOCK_EXPAND_FACTOR : 1;
}

/** 设计参考宽（× BASE_SCALE × SIZE_FACTOR 后为 zoom=1 目标屏宽） */
const LIBTV_DOCK_SCREEN_W_DESIGN = 1200;

function dockScreenScaleFactor(): number {
  return LIBTV_DOCK_BASE_SCALE * LIBTV_DOCK_SIZE_FACTOR;
}

/** zoom=1（画布 100%）时目标屏幕宽度（css px） */
export const LIBTV_DOCK_SCREEN_W_BASE = Math.round(
  LIBTV_DOCK_SCREEN_W_DESIGN * dockScreenScaleFactor(),
);
/** 画布缩 / 放到极限时坞屏宽下限（约 756px · zoom≈0.4 时即到达） */
export const LIBTV_DOCK_SCREEN_W_MIN = Math.round(
  600 * dockScreenScaleFactor(),
);
/** 画布缩小时坞不再继续放大，封顶 = 100% zoom 屏宽 */
export const LIBTV_DOCK_SCREEN_W_MAX = LIBTV_DOCK_SCREEN_W_BASE;

/**
 * 画布缩小（zoom<1）时坞屏宽线性收缩斜率。
 * factor = 1 − (1 − zoom) × SLOPE；取 5/6 使 zoom=0.4 → factor 0.5（约为 100% 的一半）。
 */
export const LIBTV_DOCK_ZOOMOUT_SLOPE = 5 / 6;

/** 画布缩小到 20% 时，Dock 内文字/缩略图相对现网再放大 3 倍（仅内容 · 外壳尺寸不变） */
export const LIBTV_DOCK_ZOOMOUT_CONTENT_BOOST_AT_MIN = 3;
export const LIBTV_DOCK_ZOOMOUT_BOOST_ANCHOR = 0.2;

/**
 * zoom≥1 为 1；zoom≤0.2 为 3；其间线性插值。
 * 使画布缩到 20% 时 Dock 内文字与缩略图仍可读。
 */
export function libtvDockZoomOutContentBoost(zoom: number): number {
  const z = Math.max(0.08, Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  if (z >= 1) return 1;
  if (z <= LIBTV_DOCK_ZOOMOUT_BOOST_ANCHOR) {
    return LIBTV_DOCK_ZOOMOUT_CONTENT_BOOST_AT_MIN;
  }
  const t = (1 - z) / (1 - LIBTV_DOCK_ZOOMOUT_BOOST_ANCHOR);
  return 1 + t * (LIBTV_DOCK_ZOOMOUT_CONTENT_BOOST_AT_MIN - 1);
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
  const z = Math.max(0.08, Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  if (z < 1) {
    return libtvDockZoomOutContentBoost(z);
  }
  const { w: fw } = libtvDockFlowSize();
  const invAtZ = computeLibtvDockInverseScale(z, fw, expanded);
  const invAt1 = computeLibtvDockInverseScale(1, fw, expanded);
  const compensate = invAt1 / (invAtZ * z);
  return Math.min(8, Math.max(1, compensate));
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
 * 目标屏宽：
 * - zoom ≥ 1（放大画布）：BASE / zoom，缩到 MIN 为止。
 * - zoom < 1（缩小画布）：BASE × (1 − (1−zoom) × SLOPE)，到 MIN 为止（不再保持 100% 尺寸）。
 */
export function computeLibtvDockScreenWidth(
  zoom: number,
  expanded = false,
): number {
  const z = Math.max(0.08, Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  const expand = libtvDockScreenExpandMultiplier(expanded);
  const factor =
    z >= 1
      ? 1 / z
      : Math.max(0, 1 - (1 - z) * LIBTV_DOCK_ZOOMOUT_SLOPE);
  const raw = LIBTV_DOCK_SCREEN_W_BASE * expand * factor;
  return Math.min(
    LIBTV_DOCK_SCREEN_W_MAX * expand,
    Math.max(LIBTV_DOCK_SCREEN_W_MIN * expand, raw),
  );
}

/**
 * 挂在 RF viewport 内：屏幕宽 ≈ flowW × zoom × invScale。
 * 令 invScale = targetScreenW / (flowW × zoom)。
 */
export function computeLibtvDockInverseScale(
  zoom: number,
  flowWidth: number,
  expanded = false,
): number {
  const z = Math.max(0.08, Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  const fw = Math.max(1, flowWidth);
  const target = computeLibtvDockScreenWidth(zoom, expanded);
  const inv = target / (fw * z);
  return Math.min(4.5, Math.max(0.1, inv));
}

/** 视频 Dock 顶栏 · 100% 画布时缩略图目标屏宽（相对旧版 size-10 ≈×2） */
export const VIDEO_DOCK_HEADER_THUMB_SCREEN_AT_100 = 64;

/** 缩略图屏上最大尺寸（画布缩到 ≤20% 时取此值） */
export const VIDEO_DOCK_HEADER_THUMB_W_MAX = 96;
export const VIDEO_DOCK_HEADER_THUMB_H_MAX = 91;
/** 画布放大时缩略图收到最大尺寸的 90% */
export const VIDEO_DOCK_HEADER_THUMB_MIN_RATIO = 0.9;
/** ≤ 此 zoom 取最大尺寸；≥ THUMB_MIN_ZOOM 取最小尺寸 */
export const VIDEO_DOCK_HEADER_THUMB_MAX_ZOOM = 0.2;
export const VIDEO_DOCK_HEADER_THUMB_MIN_ZOOM = 1;

/** 100% 画布时模式 chip 字号（屏 px · 相对旧 10px ≈×2） */
export const VIDEO_DOCK_HEADER_CHIP_FONT_AT_100 = 19;

/** 模式 chip 最小屏高（字号缩小后仍保持原 pill 高度） */
export const VIDEO_DOCK_HEADER_CHIP_MIN_HEIGHT_AT_100 = 28;

/** 视频 Dock 底栏 · 模型/积分字号（屏 px） */
export const VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100 = 13;

/** 画布缩小锚点 · 顶栏缩略图仍保持 2×100% 基准 */
export const VIDEO_DOCK_HEADER_ZOOMOUT_ANCHOR = 0.15;

/** 画布放大锚点 · 顶栏相对 100% 再 ×2 */
export const VIDEO_DOCK_HEADER_ZOOMIN_ANCHOR = 2;

/** Dock 正文 prompt · 100% 画布基准屏字号（与 PRO2_DOCK_TEXTAREA_CLASS 一致） */
export const DOCK_PROMPT_FONT_SCREEN_AT_100 = 15;

/**
 * Dock 正文 prompt 屏上字号 · 随画布 zoom。
 * - 放大至 max：比 100% 基准小 2px
 * - 缩小至 min：比 max 再小 1px（max 与 min 仅差 1 个字号）
 */
export function libtvDockPromptFontScreenMetrics(canvasZoom: number): number {
  const z = Math.max(0.08, Math.min(4, Number.isFinite(canvasZoom) ? canvasZoom : 1));
  const F = DOCK_PROMPT_FONT_SCREEN_AT_100;
  const zMin = VIDEO_DOCK_HEADER_ZOOMOUT_ANCHOR;
  const zMax = VIDEO_DOCK_HEADER_ZOOMIN_ANCHOR;
  const fontAtMax = F - 2;
  const fontAtMin = fontAtMax - 1;

  if (z <= zMin) return fontAtMin;
  if (z >= zMax) return fontAtMax;
  if (z >= 1) {
    const t = (z - 1) / (zMax - 1);
    return F + t * (fontAtMax - F);
  }
  const t = (z - zMin) / (1 - zMin);
  return fontAtMin + t * (F - fontAtMin);
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
 * 视频 / 图片 Dock 顶两栏（模式 chip + 缩略图）屏上尺寸 · 随画布 zoom。
 * 缩略图：
 * - 画布缩小（zoom ≤ 0.2）→ 最大 96×91（屏上 px，不再继续放大）
 * - 画布放大（zoom ≥ 1）→ 最小 = 最大尺寸 × 90%
 * - 之间线性插值
 * chip / badge 字号沿用旧档位，保持视频模式条观感不变。
 */
export function libtvDockVideoHeaderScreenMetrics(canvasZoom: number): {
  /** = thumbWidthScreenPx，向后兼容 */
  thumbScreenPx: number;
  thumbWidthScreenPx: number;
  thumbHeightScreenPx: number;
  chipFontScreenPx: number;
  badgeFontScreenPx: number;
} {
  const z = Math.max(0.08, Math.min(4, Number.isFinite(canvasZoom) ? canvasZoom : 1));
  const F = VIDEO_DOCK_HEADER_CHIP_FONT_AT_100;

  // 缩略图屏上尺寸：zoom≤0.2 取最大；zoom≥1 取 90%；线性插值
  const wMax = VIDEO_DOCK_HEADER_THUMB_W_MAX;
  const hMax = VIDEO_DOCK_HEADER_THUMB_H_MAX;
  const r = VIDEO_DOCK_HEADER_THUMB_MIN_RATIO;
  const zOut = VIDEO_DOCK_HEADER_THUMB_MAX_ZOOM;
  const zIn = VIDEO_DOCK_HEADER_THUMB_MIN_ZOOM;
  const tThumb =
    z <= zOut ? 0 : z >= zIn ? 1 : (z - zOut) / (zIn - zOut);
  const thumbWidthScreenPx = wMax - tThumb * (wMax * (1 - r));
  const thumbHeightScreenPx = hMax - tThumb * (hMax * (1 - r));

  // chip / badge 字号（旧档位）
  const zMin = VIDEO_DOCK_HEADER_ZOOMOUT_ANCHOR;
  const zMax = VIDEO_DOCK_HEADER_ZOOMIN_ANCHOR;
  const font2x = F * 2;
  let chipFontScreenPx: number;
  let badgeFontScreenPx: number;
  if (z <= zMin) {
    chipFontScreenPx = F - 2;
    badgeFontScreenPx = Math.max(9, F - 3);
  } else if (z >= zMax) {
    chipFontScreenPx = font2x;
    badgeFontScreenPx = Math.max(10, font2x * 0.55);
  } else if (z >= 1) {
    const t = (z - 1) / (zMax - 1);
    chipFontScreenPx = F + t * (font2x - F);
    badgeFontScreenPx = Math.max(10, chipFontScreenPx * 0.55);
  } else {
    const t = (z - zMin) / (1 - zMin);
    chipFontScreenPx = F - 2 + t * 2;
    badgeFontScreenPx = Math.max(9, F - 3 + t * 2);
  }

  return {
    thumbScreenPx: thumbWidthScreenPx,
    thumbWidthScreenPx,
    thumbHeightScreenPx,
    chipFontScreenPx,
    badgeFontScreenPx,
  };
}
