/** 画布视口缩放 · 用户可操作范围（React Flow minZoom / maxZoom） */
export const CANVAS_VIEWPORT_MIN_ZOOM = 0.05;
export const CANVAS_VIEWPORT_MAX_ZOOM = 10;

export const CANVAS_VIEWPORT_MIN_ZOOM_PCT = 5;
export const CANVAS_VIEWPORT_MAX_ZOOM_PCT = 1000;

/** 将 zoom 限制在 5%～1000% */
export function clampCanvasViewportZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(
    CANVAS_VIEWPORT_MAX_ZOOM,
    Math.max(CANVAS_VIEWPORT_MIN_ZOOM, zoom),
  );
}

export function clampCanvasViewport<T extends { x: number; y: number; zoom: number }>(
  viewport: T,
): T {
  return { ...viewport, zoom: clampCanvasViewportZoom(viewport.zoom) };
}

export function canvasViewportZoomAtMin(zoom: number): boolean {
  return zoom <= CANVAS_VIEWPORT_MIN_ZOOM + 0.0001;
}

export function canvasViewportZoomAtMax(zoom: number): boolean {
  return zoom >= CANVAS_VIEWPORT_MAX_ZOOM - 0.0001;
}
