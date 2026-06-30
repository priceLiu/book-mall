"use client";

import { useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";

/** 节点顶栏 · 屏幕坐标（portal 固定定位，避免组内/相邻节点 z 轴夹住工具条） */
export function useLibtvNodeToolbarScreenPlacement(
  nodeId: string,
  visible: boolean,
): { x: number; y: number } | null {
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const viewport = useViewportTransformActive(visible && !viewportMoving);

  return useMemo(() => {
    if (!visible || viewportMoving) return null;
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
    const pos =
      internal.internals?.positionAbsolute ?? internal.position;
    const w =
      internal.measured?.width ??
      (typeof internal.width === "number" ? internal.width : undefined) ??
      350;
    const top = flowToScreenPosition({ x: pos.x + w / 2, y: pos.y });
    return { x: top.x, y: top.y };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, visible, viewportMoving, viewport, getInternalNode, flowToScreenPosition]);
}
