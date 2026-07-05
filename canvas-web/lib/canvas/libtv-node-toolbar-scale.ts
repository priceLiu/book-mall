/**
 * 节点顶栏 zoom 缩放 · 两种场景：
 *
 * 1. **节点内联**（`Pro2ThinNodeToolbar`）：父级已随画布 zoom 缩放 → 全量补偿 scale≈1/zoom。
 * 2. **Portal 到 body**（`LibtvNodeToolbarPortal`）：与 Dock 同类思路 —— 屏上尺寸在
 *    设计范围内保持可读，画布缩小时**放大**顶栏（至上限），而非随 zoom 同比缩小。
 *
 * 设计参考：
 * - 图 3 · 100% 画布：1022 × 62（下限）
 * - 图 2 · 极限缩小画布：1583 × 85（上限）
 */

/** 0 = 随画布 1:1；1 = 完全补偿（仅节点内联顶栏） */
export const LIBTV_NODE_TOOLBAR_ZOOM_BLEND = 1;

export const LIBTV_NODE_TOOLBAR_SIZE_RATIO = 1;

export const LIBTV_NODE_TOOLBAR_MAX_SCALE = 10;
export const LIBTV_NODE_TOOLBAR_MIN_SCALE = 0.4;

/** zoom=1 · scale=1 时 CSS 自然宽/高（≈ 图 3 屏上尺寸） */
export const LIBTV_TOOLBAR_DESIGN_WIDTH = 1022;
export const LIBTV_TOOLBAR_DESIGN_HEIGHT = 62;

/** 屏上尺寸上限（图 2） */
export const LIBTV_TOOLBAR_MAX_SCREEN_WIDTH = 1583;
export const LIBTV_TOOLBAR_MAX_SCREEN_HEIGHT = 85;

/** 与 Dock 相同：画布缩到 ~8% 时视为极限 zoom out */
export const LIBTV_TOOLBAR_ZOOMOUT_ANCHOR = 0.08;

/** Portal 顶栏与节点顶边的间隙（屏幕 px） */
export const LIBTV_TOOLBAR_PORTAL_GAP_PX = 16;

function clampZoom(zoom: number): number {
  return Math.max(
    LIBTV_TOOLBAR_ZOOMOUT_ANCHOR,
    Math.min(4, Number.isFinite(zoom) && zoom > 0 ? zoom : 1),
  );
}

/**
 * 节点**内**顶栏额外 scale（父节点已随画布 zoom 缩放）。
 */
export function computeLibtvNodeToolbarTransformScale(zoom: number): number {
  const z = clampZoom(zoom);
  const fullComp = 1 / z;
  const blended = 1 + (fullComp - 1) * LIBTV_NODE_TOOLBAR_ZOOM_BLEND;
  const scaled = blended * LIBTV_NODE_TOOLBAR_SIZE_RATIO;
  return Math.min(
    LIBTV_NODE_TOOLBAR_MAX_SCALE,
    Math.max(LIBTV_NODE_TOOLBAR_MIN_SCALE, scaled),
  );
}

/**
 * Portal 顶栏目标屏宽 · 对齐 Dock 可读性策略：
 * - zoom ≥ 1：不低于设计宽（图 3）
 * - zoom < 1：随画布缩小线性放大，至图 2 上限（与 Dock 缩小时不低于 MIN 对称）
 */
export function computeLibtvToolbarScreenWidth(zoom: number): number {
  void zoom;
  return LIBTV_TOOLBAR_DESIGN_WIDTH;
}

export function computeLibtvToolbarScreenHeight(zoom: number): number {
  void zoom;
  return LIBTV_TOOLBAR_DESIGN_HEIGHT;
}

/** Portal 顶栏 transform scale（相对 CSS 自然尺寸） */
export function computeLibtvPortaledToolbarScale(zoom: number): number {
  void zoom;
  return 1;
}

export function libtvPortaledToolbarScreenSize(zoom: number): {
  width: number;
  height: number;
  scale: number;
} {
  const scale = computeLibtvPortaledToolbarScale(zoom);
  return {
    scale,
    width: computeLibtvToolbarScreenWidth(zoom),
    height: computeLibtvToolbarScreenHeight(zoom),
  };
}
