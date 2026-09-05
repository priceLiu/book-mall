"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Edge } from "@xyflow/react";
import { useViewport } from "@xyflow/react";
import { Scissors } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvSidePlusScreenDiameter,
} from "@/lib/canvas/libtv-node-chrome";
import { cn } from "@/lib/utils";

const HOVER_REVEAL_MS = 1000;
/** 鼠标沿连线移动超过此距离才重置 1s 计时 */
const HOVER_RESET_MOVE_PX = 10;
/** lg + 内图标 40px / 外圆 70px */
const CUT_ICON_TO_DOT_RATIO = 40 / 70;

export type CanvasEdgeCutHover = {
  edgeId: string;
  x: number;
  y: number;
};

type PendingHover = {
  edgeId: string;
  anchorX: number;
  anchorY: number;
  lastX: number;
  lastY: number;
};

function pointerInCutZone(
  clientX: number,
  clientY: number,
  cut: CanvasEdgeCutHover,
  hitRadiusPx: number,
): boolean {
  return Math.hypot(clientX - cut.x, clientY - cut.y) <= hitRadiusPx;
}

/**
 * 连线悬停 1s → 在鼠标处显示剪刀并保持；离开连线后消失；点击剪断。
 * 剪刀层 pointer-events:none，避免挡住连线命中；点击由 document 捕获阶段命中检测。
 */
export function useCanvasEdgeCutHover() {
  const { zoom } = useViewport();
  const cutButtonPx = libtvSidePlusScreenDiameter(
    zoom,
    LIBTV_NODE_SIDE_PLUS_SIZE,
  );
  const cutHitRadiusPx = cutButtonPx / 2;
  const cutIconPx = cutButtonPx * CUT_ICON_TO_DOT_RATIO;

  const setEdges = useCanvasStore((s) => s.setEdges);

  const [cut, setCut] = useState<CanvasEdgeCutHover | null>(null);
  const [cutHot, setCutHot] = useState(false);
  const pendingRef = useRef<PendingHover | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutRef = useRef<CanvasEdgeCutHover | null>(null);
  const hoveringEdgeIdRef = useRef<string | null>(null);

  useEffect(() => {
    cutRef.current = cut;
  }, [cut]);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current != null) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const hideCut = useCallback(() => {
    setCut(null);
    setCutHot(false);
    pendingRef.current = null;
    hoveringEdgeIdRef.current = null;
  }, []);

  const revealCut = useCallback((edgeId: string, clientX: number, clientY: number) => {
    setCut({
      edgeId,
      x: clientX,
      y: clientY,
    });
  }, []);

  const armReveal = useCallback(
    (edgeId: string, clientX: number, clientY: number) => {
      if (cutRef.current?.edgeId === edgeId) return;

      clearRevealTimer();
      pendingRef.current = {
        edgeId,
        anchorX: clientX,
        anchorY: clientY,
        lastX: clientX,
        lastY: clientY,
      };
      revealTimerRef.current = setTimeout(() => {
        const pending = pendingRef.current;
        if (!pending || pending.edgeId !== edgeId) return;
        if (hoveringEdgeIdRef.current !== edgeId) return;
        revealCut(edgeId, pending.lastX, pending.lastY);
      }, HOVER_REVEAL_MS);
    },
    [clearRevealTimer, revealCut],
  );

  const onEdgeMouseEnter = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      hoveringEdgeIdRef.current = edge.id;
      if (cutRef.current && cutRef.current.edgeId !== edge.id) {
        hideCut();
      }
      if (cutRef.current?.edgeId === edge.id) return;
      armReveal(edge.id, event.clientX, event.clientY);
    },
    [armReveal, hideCut],
  );

  const onEdgeMouseMove = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      hoveringEdgeIdRef.current = edge.id;
      const { clientX, clientY } = event;

      if (cutRef.current?.edgeId === edge.id) {
        return;
      }

      const pending = pendingRef.current;
      if (!pending || pending.edgeId !== edge.id) {
        armReveal(edge.id, clientX, clientY);
        return;
      }

      pending.lastX = clientX;
      pending.lastY = clientY;

      const moved = Math.hypot(
        clientX - pending.anchorX,
        clientY - pending.anchorY,
      );
      if (moved >= HOVER_RESET_MOVE_PX) {
        armReveal(edge.id, clientX, clientY);
      }
    },
    [armReveal],
  );

  const onEdgeMouseLeave = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (hoveringEdgeIdRef.current === edge.id) {
        hoveringEdgeIdRef.current = null;
      }
      clearRevealTimer();
      pendingRef.current = null;
      if (cutRef.current?.edgeId === edge.id) {
        hideCut();
      }
    },
    [clearRevealTimer, hideCut],
  );

  const onCut = useCallback(() => {
    const id = cutRef.current?.edgeId;
    if (!id) return;
    setEdges((edges) => edges.filter((e) => e.id !== id));
    hideCut();
    clearRevealTimer();
  }, [setEdges, hideCut, clearRevealTimer]);

  useEffect(
    () => () => {
      clearRevealTimer();
    },
    [clearRevealTimer],
  );

  /** 剪刀居中叠在鼠标上时不抢连线 pointer；捕获阶段检测点击 */
  useEffect(() => {
    if (!cut) return;

    const onPointerMove = (e: PointerEvent) => {
      const c = cutRef.current;
      if (!c) {
        setCutHot(false);
        return;
      }
      setCutHot(pointerInCutZone(e.clientX, e.clientY, c, cutHitRadiusPx));
    };

    const onPointerDown = (e: PointerEvent) => {
      const c = cutRef.current;
      if (!c || e.button !== 0) return;
      if (!pointerInCutZone(e.clientX, e.clientY, c, cutHitRadiusPx)) return;
      e.preventDefault();
      e.stopPropagation();
      onCut();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [cut, onCut, cutHitRadiusPx]);

  const portal =
    cut && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{
              position: "fixed",
              left: cut.x,
              top: cut.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 20080,
            }}
            className="canvas-edge-cut-portal nodrag nopan"
          >
            <div
              role="button"
              aria-label="剪断连线"
              title="剪断连线"
              style={{
                width: cutButtonPx,
                height: cutButtonPx,
              }}
              className={cn(
                "flex items-center justify-center rounded-full border border-white/25 bg-[#1a1a1e] text-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.45)] transition-colors",
                cutHot &&
                  "border-red-400/70 bg-red-500/35 text-red-100",
              )}
            >
              <Scissors
                style={{ width: cutIconPx, height: cutIconPx }}
                strokeWidth={2.25}
                aria-hidden
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return {
    onEdgeMouseEnter,
    onEdgeMouseMove,
    onEdgeMouseLeave,
    cutPortal: portal,
  };
}
