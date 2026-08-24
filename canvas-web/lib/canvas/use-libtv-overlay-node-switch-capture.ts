"use client";

import { useCallback } from "react";
import { dispatchCanvasRfSelectNode } from "./canvas-rf-sync";
import { pickLibtvCanvasNodeFromDomAtPoint } from "./libtv-canvas-node-pick";
import { useCanvasStore } from "./store";

/**
 * 浮动 Dock / 顶栏 portal 盖在其他节点上时：若点击位置 DOM 栈里属于另一节点，则切选中。
 * 返回 true 表示已切走，调用方应 stopPropagation。
 */
export function useLibtvOverlayNodeSwitchCapture(
  anchorNodeId: string | null | undefined,
): (e: React.PointerEvent) => boolean {
  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return false;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
      const anchor = anchorNodeId?.trim();
      if (!anchor) return false;

      const picked = pickLibtvCanvasNodeFromDomAtPoint(e.clientX, e.clientY);
      if (!picked || picked === anchor) return false;

      dispatchCanvasRfSelectNode(picked);
      useCanvasStore.getState().setLibtvInputDockFocused(false);
      window.dispatchEvent(new CustomEvent("canvas:suppress-next-pane-click"));
      return true;
    },
    [anchorNodeId],
  );
}
