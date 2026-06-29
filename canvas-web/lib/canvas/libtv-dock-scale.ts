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
