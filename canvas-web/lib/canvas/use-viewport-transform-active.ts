"use client";

import { useRef } from "react";
import { useStore } from "@xyflow/react";

export type FlowViewport = { x: number; y: number; zoom: number };

/**
 * 仅 `active=true` 时订阅 pan/zoom transform。
 * 侧栏 +、组节点等默认不 active，避免缩放时每帧重渲染整图节点。
 */
export function useViewportTransformActive(active: boolean): FlowViewport {
  const activeRef = useRef(active);
  activeRef.current = active;

  return useStore(
    (s) => ({
      x: s.transform[0],
      y: s.transform[1],
      zoom: s.transform[2],
    }),
    (a, b) =>
      !activeRef.current ||
      (a.x === b.x && a.y === b.y && a.zoom === b.zoom),
  );
}

/** 浮动 Dock：节点拖动或视口 pan/zoom 期间隐藏，减轻缩放卡顿 */
export function libtvFloatingDockHidden(
  geometryDragging: boolean,
  viewportMoving: boolean,
): boolean {
  return geometryDragging || viewportMoving;
}
