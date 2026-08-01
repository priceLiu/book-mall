import { libtvCanvasUiMaxScreenWidth } from "./libtv-canvas-viewport-reflow";

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
 * Portal 顶栏 transform scale（相对 CSS 自然尺寸）。
 * 不随画布 zoom 放大；仅按视口收窄，避免 zoom 很小时顶栏撑满屏。
 */
export function computeLibtvPortaledToolbarScale(zoom: number): number {
  void zoom;
  if (typeof window === "undefined") return 1;
  const maxW = libtvCanvasUiMaxScreenWidth();
  return Math.min(1, maxW / LIBTV_TOOLBAR_DESIGN_WIDTH);
}

export function computeLibtvToolbarScreenWidth(zoom: number): number {
  void zoom;
  return Math.min(
    LIBTV_TOOLBAR_DESIGN_WIDTH,
    libtvCanvasUiMaxScreenWidth(),
  );
}

export function computeLibtvToolbarScreenHeight(zoom: number): number {
  void zoom;
  const width = computeLibtvToolbarScreenWidth(zoom);
  const scale = width / LIBTV_TOOLBAR_DESIGN_WIDTH;
  return Math.round(LIBTV_TOOLBAR_DESIGN_HEIGHT * scale);
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
