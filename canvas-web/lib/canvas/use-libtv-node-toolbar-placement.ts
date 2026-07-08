"use client";

import { useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  libtvFloatingDockHidden,
  useViewportTransformActive,
} from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  pro2NodeAbsolutePosition,
  pro2NodeBoxSize,
} from "@/lib/canvas/pro2-selection-bbox";

/** 拖动所属节点时隐藏顶栏（与浮动 Dock 同一规则） */
export function useLibtvNodeToolbarHidden(nodeId: string): boolean {
  return useCanvasStore((s) =>
    libtvFloatingDockHidden(s.canvasDraggingNodeId, nodeId),
  );
}

/** 节点顶栏 · 屏幕坐标（portal 固定定位，避免组内/相邻节点 z 轴夹住工具条） */
export function useLibtvNodeToolbarScreenPlacement(
  nodeId: string,
  visible: boolean,
): { x: number; y: number } | null {
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const flowNode = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
  const allNodes = useCanvasStore((s) => s.nodes);
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const viewport = useViewportTransformActive(visible && !viewportMoving);

  return useMemo(() => {
    if (!visible || viewportMoving || !flowNode) return null;
    const internal = getInternalNode(nodeId) as
      | {
          measured?: { width?: number; height?: number };
          position: { x: number; y: number };
          internals?: { positionAbsolute?: { x: number; y: number } };
          width?: number;
          height?: number;
        }
      | undefined;

    let pos: { x: number; y: number };
    let w: number;

    if (internal) {
      pos =
        internal.internals?.positionAbsolute ?? internal.position;
      const { w: boxW } = pro2NodeBoxSize(flowNode);
      w =
        internal.measured?.width ??
        (typeof internal.width === "number" ? internal.width : undefined) ??
        boxW;
    } else {
      pos = pro2NodeAbsolutePosition(flowNode, allNodes);
      w = pro2NodeBoxSize(flowNode).w;
    }

    const top = flowToScreenPosition({ x: pos.x + w / 2, y: pos.y });
    return { x: top.x, y: top.y };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nodeId,
    visible,
    viewportMoving,
    viewport,
    getInternalNode,
    flowToScreenPosition,
    flowNode,
    allNodes,
  ]);
}
