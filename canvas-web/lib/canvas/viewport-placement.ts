import type { CanvasNodeType } from "./types";
import {
  NODE_DEFAULT_SIZE,
  STORY_FRAME_IMAGE_ENGINE_SIZE,
} from "./types";

type ScreenToFlow = (point: { x: number; y: number }) => { x: number; y: number };

let placementCtx: {
  screenToFlowPosition: ScreenToFlow;
  getContainer: () => HTMLElement | null;
} | null = null;

/** FlowCanvas 挂载时注册，卸载时清除。 */
export function registerCanvasViewportPlacement(ctx: {
  screenToFlowPosition: ScreenToFlow;
  getContainer: () => HTMLElement | null;
}) {
  placementCtx = ctx;
}

export function unregisterCanvasViewportPlacement() {
  placementCtx = null;
}

function nodeDefaultSize(
  type: CanvasNodeType,
  data?: Record<string, unknown>,
): { width: number; height: number } {
  if (type === "image-engine" && typeof data?.frameIndex === "number") {
    return STORY_FRAME_IMAGE_ENGINE_SIZE;
  }
  return NODE_DEFAULT_SIZE[type] ?? { width: 320, height: 240 };
}

/** 将新节点中心对齐当前画布视口中心（工具条点击 / 插入角色等）。 */
export function flowPositionAtViewportCenter(
  type: CanvasNodeType,
  data?: Record<string, unknown>,
): { x: number; y: number } {
  const size = nodeDefaultSize(type, data);
  const jitter = 24;
  const fallback = {
    x: 240 - size.width / 2 + (Math.random() - 0.5) * jitter,
    y: 160 - size.height / 2 + (Math.random() - 0.5) * jitter,
  };

  const container = placementCtx?.getContainer() ?? null;
  if (!container || !placementCtx) return fallback;

  const rect = container.getBoundingClientRect();
  const flow = placementCtx.screenToFlowPosition({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });

  return {
    x: flow.x - size.width / 2 + (Math.random() - 0.5) * jitter,
    y: flow.y - size.height / 2 + (Math.random() - 0.5) * jitter,
  };
}
