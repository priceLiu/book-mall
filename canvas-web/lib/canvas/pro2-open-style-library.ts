"use client";

import { useCanvasStore } from "./store";

/** 图片 / 三视图节点 · 打开风格库并在选中后为该节点 spawn 风格素材 */
export function openPro2StyleLibraryForMediaNode(nodeId: string): void {
  useCanvasStore.getState().setPro2StyleLibImageNodeId(nodeId);
  window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
}
