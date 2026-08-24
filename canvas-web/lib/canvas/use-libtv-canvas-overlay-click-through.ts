"use client";

import { useEffect } from "react";
import { dispatchCanvasRfSelectNode } from "./canvas-rf-sync";
import {
  isLibtvCanvasOverlayInteractiveTarget,
  isLibtvCanvasOverlayLayer,
  pickLibtvCanvasNodeFromDomAtPoint,
} from "./libtv-canvas-node-pick";
import { useCanvasStore } from "./store";

function readRfSelectedNodeIds(): Set<string> {
  const ids = new Set<string>();
  if (typeof document === "undefined") return ids;
  for (const el of document.querySelectorAll(".react-flow__node.selected")) {
    const id = (el as HTMLElement).dataset.id?.trim();
    if (id) ids.add(id);
  }
  return ids;
}

function suppressNextPaneClick(): void {
  window.dispatchEvent(new CustomEvent("canvas:suppress-next-pane-click"));
}

/**
 * 画布级 capture：仅当点击落在 Dock / 顶栏 portal 的非交互区域时，
 * 用 elementsFromPoint 切到下方节点。节点本体点击/拖拽交给 React Flow，勿 intercept。
 */
export function useLibtvCanvasOverlayClickThrough(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const root = document.querySelector(".canvas-flow-wrap");
    if (!root) return;

    const onPointerDownCapture = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      // 快路径：非 overlay 零开销，勿阻塞节点 drag 起手
      if (!isLibtvCanvasOverlayLayer(target)) return;
      if (isLibtvCanvasOverlayInteractiveTarget(target)) return;

      const pickedNodeId = pickLibtvCanvasNodeFromDomAtPoint(
        event.clientX,
        event.clientY,
      );
      if (!pickedNodeId) return;

      const selectedIds = readRfSelectedNodeIds();
      if (selectedIds.size === 1 && selectedIds.has(pickedNodeId)) return;

      dispatchCanvasRfSelectNode(pickedNodeId);
      suppressNextPaneClick();
      useCanvasStore.getState().setLibtvInputDockFocused(false);
      event.stopPropagation();
    };

    root.addEventListener("pointerdown", onPointerDownCapture, true);
    return () =>
      root.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [enabled]);
}
