"use client";

import { useCallback } from "react";
import { useStore } from "@xyflow/react";

export type FlowViewport = { x: number; y: number; zoom: number };

/**
 * 仅 `active=true` 时订阅 pan/zoom transform。
 * 侧栏 +、组节点等默认不 active，避免缩放时每帧重渲染整图节点。
 */
export function useViewportTransformActive(active: boolean): FlowViewport {
  const equals = useCallback(
    (a: FlowViewport, b: FlowViewport) =>
      !active || (a.x === b.x && a.y === b.y && a.zoom === b.zoom),
    [active],
  );

  return useStore(
    (s) => ({
      x: s.transform[0],
      y: s.transform[1],
      zoom: s.transform[2],
    }),
    equals,
  );
}

/**
 * 浮动 Dock 是否隐藏。
 * - 画布 pan/zoom：不隐藏（由 flow-canvas onMoveStart 清掉误触的 geometryDragging）
 * - 节点拖动：仅隐藏「正在被拖」的那张卡片的 Dock，其它节点已打开的 Dock 保持
 */
export function libtvFloatingDockHidden(
  geometryDragging: boolean,
  draggingNodeId?: string | null,
  dockNodeId?: string | null,
): boolean {
  if (!geometryDragging) return false;
  if (!dockNodeId) return true;
  return draggingNodeId === dockNodeId;
}
