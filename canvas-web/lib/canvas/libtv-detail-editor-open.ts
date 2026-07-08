"use client";

import { useCanvasStore } from "./store";

/** 节点详情弹层打开时，浮动 Dock / 顶栏应隐藏 */
export function libtvDetailEditorOpenForNode(nodeId: string | null): boolean {
  if (!nodeId) return false;
  const s = useCanvasStore.getState();
  return (
    s.pro2ScriptTableEditorNodeId === nodeId ||
    s.pro2TextOutlineEditorNodeId === nodeId
  );
}
