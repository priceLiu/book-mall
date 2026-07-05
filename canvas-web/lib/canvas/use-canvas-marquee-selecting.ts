"use client";

import { useStore } from "@xyflow/react";
import { useCanvasStore } from "./store";

/** 用户正在拖空白框选（尚未松手）· 此期间不展示节点顶栏 / 浮动 Dock / 框选工具条 */
export function useCanvasMarqueeSelecting(): boolean {
  const userSelectionActive = useStore((s) => s.userSelectionActive);
  const canvasMarqueeSelecting = useCanvasStore((s) => s.canvasMarqueeSelecting);
  const canvasSelectionDragging = useCanvasStore((s) => s.canvasSelectionDragging);
  return userSelectionActive || canvasMarqueeSelecting || canvasSelectionDragging;
}
