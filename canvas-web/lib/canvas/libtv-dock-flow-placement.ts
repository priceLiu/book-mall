"use client";

import { useCallback, useMemo } from "react";
import { useStore, useViewport } from "@xyflow/react";
import { PRO2_DOCK_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";

/** 节点底边与输入坞之间的画布间距（px · flow 坐标） */
export const LIBTV_DOCK_GAP = 24;

export type LibtvDockFlowPlacement = {
  flowX: number;
  flowY: number;
  flowW: number;
};

type NodeFlowGeometry = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function geometryEqual(a: NodeFlowGeometry | null, b: NodeFlowGeometry | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/**
 * 输入坞锚点（画布 flow 坐标 · 随节点拖动 / pan/zoom 实时更新）。
 * 订阅 React Flow nodeLookup，避免松手后 zustand 与 RF 短暂不同步导致定位偏移。
 */
export function useLibtvDockFlowPlacement(
  nodeId: string | null,
  opts?: {
    minFlowWidth?: number;
    defaultNodeWidth?: number;
    defaultNodeHeight?: number;
  },
): LibtvDockFlowPlacement | null {
  const viewport = useViewport();

  const geometry = useStore(
    useCallback(
      (state) => {
        if (!nodeId) return null;
        const node = state.nodeLookup.get(nodeId);
        if (!node) return null;

        const w =
          node.measured?.width ??
          (typeof node.width === "number" ? node.width : undefined) ??
          opts?.defaultNodeWidth ??
          PRO2_DOCK_WIDTH;
        const h =
          node.measured?.height ??
          (typeof node.height === "number" ? node.height : undefined) ??
          opts?.defaultNodeHeight ??
          280;
        const pos = node.internals?.positionAbsolute ?? node.position;

        return { x: pos.x, y: pos.y, w, h } satisfies NodeFlowGeometry;
      },
      [nodeId, opts?.defaultNodeWidth, opts?.defaultNodeHeight],
    ),
    geometryEqual,
  );

  return useMemo(() => {
    if (!nodeId || !geometry) return null;
    const minW = opts?.minFlowWidth ?? PRO2_DOCK_WIDTH;

    return {
      flowX: geometry.x + geometry.w / 2,
      flowY: geometry.y + geometry.h + LIBTV_DOCK_GAP,
      flowW: Math.max(geometry.w, minW),
    };
  }, [
    nodeId,
    geometry,
    viewport.x,
    viewport.y,
    viewport.zoom,
    opts?.minFlowWidth,
  ]);
}
