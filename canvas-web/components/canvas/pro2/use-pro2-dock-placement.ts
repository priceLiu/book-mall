"use client";

import { useEffect, useMemo, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { PRO2_DOCK_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";

const GAP = 20;

function dockAnchorRect(nodeId: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`[data-pro2-dock-anchor="${nodeId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

/** 输入坞锚定在节点底边正中（DOM 实测优先，组内子节点回退绝对坐标） */
export function usePro2DockPlacement(nodeId: string | null) {
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewport = useViewport();
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const sync = () =>
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!nodeId) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [nodeId, viewport.x, viewport.y, viewport.zoom]);

  return useMemo(() => {
    if (!nodeId || windowSize.w <= 0) return null;

    const domRect = dockAnchorRect(nodeId);
    let centerX: number;
    let bottomY: number;

    if (domRect) {
      centerX = domRect.left + domRect.width / 2;
      bottomY = domRect.bottom;
    } else {
      const internal = getInternalNode(nodeId) as
        | {
            measured?: { width?: number; height?: number };
            position: { x: number; y: number };
            internals?: { positionAbsolute?: { x: number; y: number } };
            width?: number;
            height?: number;
          }
        | undefined;
      if (!internal) return null;
      const w =
        internal.measured?.width ??
        (typeof internal.width === "number" ? internal.width : 280);
      const h =
        internal.measured?.height ??
        (typeof internal.height === "number" ? internal.height : 280);
      const pos = internal.internals?.positionAbsolute ?? internal.position;
      const anchor = flowToScreenPosition({ x: pos.x + w / 2, y: pos.y + h });
      centerX = anchor.x;
      bottomY = anchor.y;
    }

    const dockW = PRO2_DOCK_WIDTH;
    const left = Math.min(
      windowSize.w - 16 - dockW / 2,
      Math.max(16 + dockW / 2, centerX),
    );
    return { left, top: bottomY + GAP, dockW };
  }, [
    nodeId,
    windowSize,
    viewport,
    tick,
    flowToScreenPosition,
    getInternalNode,
  ]);
}
