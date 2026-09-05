import type { Viewport } from "@xyflow/react";
import type { CanvasFlowNode } from "./types";
import { libtvMediaNodesNeedViewportReflow } from "./libtv-media-node-size";
import {
  CANVAS_VIEWPORT_MAX_ZOOM,
  CANVAS_VIEWPORT_MIN_ZOOM,
} from "./canvas-viewport-zoom";

/** fitView 下限：再缩小会导致节点过小、Dock/顶栏相对「撑满屏幕」 */
export const LIBTV_CANVAS_REFLOW_MIN_ZOOM = 0.22;
/** fitView 上限：节点统一放大后旧 zoom>1 会把内容挤出视口 */
export const LIBTV_CANVAS_REFLOW_MAX_ZOOM = 1;

export const LIBTV_CANVAS_UI_MAX_VIEWPORT_WIDTH_RATIO = 0.92;

export function libtvCanvasUiMaxScreenWidth(): number {
  if (typeof window === "undefined") return 1583;
  return Math.round(window.innerWidth * LIBTV_CANVAS_UI_MAX_VIEWPORT_WIDTH_RATIO);
}

export function libtvViewportZoomNeedsReflow(zoom: number): boolean {
  if (!Number.isFinite(zoom) || zoom <= 0) return true;
  if (zoom < CANVAS_VIEWPORT_MIN_ZOOM) return true;
  if (zoom > CANVAS_VIEWPORT_MAX_ZOOM) return true;
  return false;
}

/** hydrate / 打开 LibTV 画布：是否须 fitView 纠正 pan/zoom */
export function libtvCanvasNeedsViewportReflow(
  nodes: CanvasFlowNode[],
  viewport?: Pick<Viewport, "zoom"> | null,
): boolean {
  if (libtvMediaNodesNeedViewportReflow(nodes)) return true;
  if (viewport && libtvViewportZoomNeedsReflow(viewport.zoom)) return true;
  return false;
}

export function libtvCanvasReflowFitViewOptions(): {
  padding: number;
  duration: number;
  maxZoom: number;
  minZoom: number;
} {
  return {
    padding: 0.12,
    duration: 0,
    maxZoom: LIBTV_CANVAS_REFLOW_MAX_ZOOM,
    minZoom: LIBTV_CANVAS_REFLOW_MIN_ZOOM,
  };
}
