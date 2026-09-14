"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";

import { batchConnectSelectionScreenBox } from "@/lib/canvas/batch-connect-preview-anchors";
import { pro2SelectedNonGroupIds } from "@/lib/canvas/pro2-selection-bbox";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { useClientPortalMounted, useCanvasToolbarPopoverOpen } from "@/lib/canvas/use-modal-portal-effects";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasFlowNode } from "@/lib/canvas/types";

/** LibTV / Pro2 · 多选虚线框（DOM 包围盒 · 替代 RF 易偏大的 nodesselection-rect） */
export function LibtvMultiSelectionOutline({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const mounted = useClientPortalMounted();
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const toolbarPopoverOpen = useCanvasToolbarPopoverOpen();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const storeNodes = useCanvasStore((s) => s.nodes);
  const { flowToScreenPosition, getInternalNode } = useReactFlow();

  const selectedIds = useMemo(
    () => pro2SelectedNonGroupIds(rfNodes),
    [rfNodes],
  );

  const viewport = useViewportTransformActive(
    selectedIds.length >= 2 && !marqueeSelecting && !viewportMoving,
  );

  const screenBox = useMemo(() => {
    void viewport;
    if (selectedIds.length < 2) return null;
    const pool = (rfNodes.length ? rfNodes : storeNodes) as CanvasFlowNode[];
    return batchConnectSelectionScreenBox(
      selectedIds,
      pool,
      flowToScreenPosition,
      getInternalNode,
    );
  }, [
    selectedIds,
    viewport,
    rfNodes,
    storeNodes,
    flowToScreenPosition,
    getInternalNode,
  ]);

  if (
    !mounted ||
    marqueeSelecting ||
    viewportMoving ||
    toolbarPopoverOpen ||
    selectedIds.length < 2 ||
    !screenBox
  ) {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed z-[1490] rounded-sm border-2 border-dashed border-white/40"
      style={{
        left: screenBox.left,
        top: screenBox.top,
        width: screenBox.width,
        height: screenBox.height,
      }}
      aria-hidden
    />,
    document.body,
  );
}
