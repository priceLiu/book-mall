"use client";

import { useEffect, useMemo, useState } from "react";
import { useViewport } from "@xyflow/react";
import { PRO2_DOCK_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";

const GAP = 12;

function cellAnchorRect(nodeId: string, rowKey: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(
    `[data-pro2-frame-cell="${nodeId}:${rowKey}"]`,
  );
  return el?.getBoundingClientRect() ?? null;
}

/** 分镜图单格底边正中 · 输入坞锚点（随视口 / 节点拖动刷新） */
export function usePro2FrameCellDockPlacement(
  nodeId: string | null,
  rowKey: string | null,
) {
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
    if (!nodeId || !rowKey) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [nodeId, rowKey, viewport.x, viewport.y, viewport.zoom]);

  return useMemo(() => {
    if (!nodeId || !rowKey || windowSize.w <= 0) return null;
    const rect = cellAnchorRect(nodeId, rowKey);
    if (!rect) return null;

    const dockW = PRO2_DOCK_WIDTH;
    const centerX = rect.left + rect.width / 2;
    const left = Math.min(
      windowSize.w - 16 - dockW / 2,
      Math.max(16 + dockW / 2, centerX),
    );
    return { left, top: rect.bottom + GAP, dockW };
  }, [nodeId, rowKey, windowSize, viewport, tick]);
}
