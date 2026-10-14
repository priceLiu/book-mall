"use client";

import { useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useReactFlow, useStore } from "@xyflow/react";

import { libtvSelectionFlowBoxToScreenBox } from "@/lib/canvas/batch-connect-preview-anchors";
import {
  applySelectionDragDelta,
  libtvSelectionFlowBox,
} from "@/lib/canvas/libtv-marquee-hit";
import { useCanvasStore } from "@/lib/canvas/store";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

/** LibTV / Pro2 · 多选虚线框（屏幕坐标定位 · 缩小画布仍可见） */
export function LibtvMultiSelectionOutline({
  rfNodes,
  setRfNodes,
  onDragStart,
  onDragStop,
}: {
  rfNodes: CanvasFlowNode[];
  setRfNodes: (
    payload:
      | CanvasFlowNode[]
      | ((nodes: CanvasFlowNode[]) => CanvasFlowNode[]),
  ) => void;
  onDragStart: () => void;
  onDragStop: () => void;
}) {
  const userSelectionActive = useStore((s) => s.userSelectionActive);
  const canvasMarqueeSelecting = useCanvasStore((s) => s.canvasMarqueeSelecting);
  const hideForLiveMarquee = userSelectionActive || canvasMarqueeSelecting;
  const viewport = useViewportTransformActive(true);
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();

  const dragRef = useRef<{
    last: { x: number; y: number };
    pointerId: number;
    pendingDx: number;
    pendingDy: number;
    raf: number;
  } | null>(null);

  const selectedIds = useMemo(
    () => rfNodes.filter((n) => n.selected).map((n) => n.id),
    [rfNodes],
  );

  const flowBox = useMemo(() => {
    if (selectedIds.length < 2) return null;
    return libtvSelectionFlowBox(rfNodes, selectedIds);
  }, [rfNodes, selectedIds]);

  const screenBox = useMemo(() => {
    void viewport;
    if (!flowBox) return null;
    return libtvSelectionFlowBoxToScreenBox(flowBox, flowToScreenPosition);
  }, [flowBox, flowToScreenPosition, viewport]);

  const flushPending = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.raf) {
      cancelAnimationFrame(drag.raf);
      drag.raf = 0;
    }
    const { pendingDx, pendingDy } = drag;
    drag.pendingDx = 0;
    drag.pendingDy = 0;
    if (pendingDx === 0 && pendingDy === 0) return;
    setRfNodes((prev) => applySelectionDragDelta(prev, pendingDx, pendingDy));
  }, [setRfNodes]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      dragRef.current = {
        last: flow,
        pointerId: e.pointerId,
        pendingDx: 0,
        pendingDy: 0,
        raf: 0,
      };
      onDragStart();
    },
    [onDragStart, screenToFlowPosition],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const dx = flow.x - drag.last.x;
      const dy = flow.y - drag.last.y;
      drag.last = flow;
      if (dx === 0 && dy === 0) return;
      drag.pendingDx += dx;
      drag.pendingDy += dy;
      if (drag.raf) return;
      drag.raf = requestAnimationFrame(() => {
        if (!dragRef.current) return;
        drag.raf = 0;
        flushPending();
      });
    },
    [flushPending, screenToFlowPosition],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      flushPending();
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      requestAnimationFrame(() => {
        onDragStop();
      });
    },
    [flushPending, onDragStop],
  );

  if (
    hideForLiveMarquee ||
    selectedIds.length < 2 ||
    !flowBox ||
    !screenBox ||
    screenBox.width < 2 ||
    screenBox.height < 2
  ) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "nopan nodrag nowheel pointer-events-auto fixed z-[1001] cursor-grab rounded-sm border-dotted active:cursor-grabbing",
      )}
      style={{
        left: screenBox.left,
        top: screenBox.top,
        width: Math.max(1, screenBox.width),
        height: Math.max(1, screenBox.height),
        borderWidth: 2,
        borderColor: "rgba(96, 165, 250, 0.95)",
        backgroundColor: "rgba(59, 130, 246, 0.12)",
        boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.45)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />,
    document.body,
  );
}
