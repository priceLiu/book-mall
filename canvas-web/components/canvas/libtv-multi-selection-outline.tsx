"use client";

import { useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useReactFlow, useStore } from "@xyflow/react";

import {
  applySelectionDragDelta,
  libtvSelectionFlowBox,
} from "@/lib/canvas/libtv-marquee-hit";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

/** LibTV / Pro2 · 多选虚线框（画在 RF viewport 里，与节点同一套 flow 坐标，避免拖影） */
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
  /** 只在「正在拖空白框选」时藏框；整组拖动中必须保持挂载，否则 pointer capture 会丢。 */
  const userSelectionActive = useStore((s) => s.userSelectionActive);
  const canvasMarqueeSelecting = useCanvasStore((s) => s.canvasMarqueeSelecting);
  const hideForLiveMarquee = userSelectionActive || canvasMarqueeSelecting;
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const rfDom = useStore((s) => s.domNode);
  const zoom = useStore((s) => s.transform[2]) || 1;
  const viewportEl =
    rfDom?.querySelector<HTMLElement>(".react-flow__viewport") ?? null;
  const { screenToFlowPosition } = useReactFlow();
  /** 画在 viewport 内会随缩放变细，按屏幕 3px 反算 */
  const strokePx = 3 / zoom;

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
    !viewportEl ||
    hideForLiveMarquee ||
    viewportMoving ||
    selectedIds.length < 2 ||
    !flowBox
  ) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "nopan nodrag nowheel pointer-events-auto absolute z-[1001] cursor-grab rounded-sm border-dotted active:cursor-grabbing",
      )}
      style={{
        left: 0,
        top: 0,
        transform: `translate(${flowBox.x}px, ${flowBox.y}px)`,
        width: flowBox.w,
        height: flowBox.h,
        borderWidth: strokePx,
        borderColor: "rgba(96, 165, 250, 0.95)",
        backgroundColor: "rgba(59, 130, 246, 0.12)",
        boxShadow: `0 0 0 ${1.25 / zoom}px rgba(0, 0, 0, 0.45)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />,
    viewportEl,
  );
}
