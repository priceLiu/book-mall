"use client";

import { useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { PRO2_DOCK_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";

const GAP = 12;

function cellAnchorRect(nodeId: string, rowKey: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(
    `[data-pro2-frame-cell="${nodeId}:${rowKey}"]`,
  );
  return el?.getBoundingClientRect() ?? null;
}

/** 分镜图单格底边正中 · 输入坞锚点（flow 坐标 · 与 LibTV 浮动 Dock 一致） */
export function usePro2FrameCellDockPlacement(
  nodeId: string | null,
  rowKey: string | null,
): LibtvDockFlowPlacement | null {
  const { screenToFlowPosition } = useReactFlow();
  const active = Boolean(nodeId && rowKey);
  const viewport = useViewportTransformActive(active);
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
  const [layoutTick, setLayoutTick] = useState(0);

  useEffect(() => {
    const sync = () =>
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = window.requestAnimationFrame(() => {
      setLayoutTick((t) => t + 1);
    });
    return () => window.cancelAnimationFrame(id);
  }, [active, nodeId, rowKey]);

  return useMemo(() => {
    if (!nodeId || !rowKey || windowSize.w <= 0) return null;
    const rect = cellAnchorRect(nodeId, rowKey);
    if (!rect) return null;

    const centerX = rect.left + rect.width / 2;
    const anchor = screenToFlowPosition({
      x: centerX,
      y: rect.bottom + GAP,
    });

    return {
      flowX: anchor.x,
      flowY: anchor.y,
      flowW: PRO2_DOCK_WIDTH,
    };
  }, [
    nodeId,
    rowKey,
    windowSize,
    layoutTick,
    viewport.x,
    viewport.y,
    viewport.zoom,
    screenToFlowPosition,
  ]);
}
