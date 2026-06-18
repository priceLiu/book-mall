"use client";

import { useCallback, useMemo, useRef } from "react";
import { useStore } from "@xyflow/react";
import { PRO2_DOCK_WIDTH } from "@/lib/canvas/story-pro2-node-chrome";
import { useCanvasStore } from "./store";
import type { CanvasFlowNode } from "./types";

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

type PlacementOpts = {
  minFlowWidth?: number;
  defaultNodeWidth?: number;
  defaultNodeHeight?: number;
};

function geometryEqual(a: NodeFlowGeometry | null, b: NodeFlowGeometry | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function nodeStyleSize(node: CanvasFlowNode, axis: "width" | "height"): number | undefined {
  const style = node.style;
  if (typeof style !== "object" || !style) return undefined;
  const v = style[axis];
  return typeof v === "number" ? v : undefined;
}

function geometryFromStoreNode(
  node: CanvasFlowNode,
  opts?: PlacementOpts,
): NodeFlowGeometry {
  const w =
    (typeof node.width === "number" ? node.width : undefined) ??
    nodeStyleSize(node, "width") ??
    opts?.defaultNodeWidth ??
    PRO2_DOCK_WIDTH;
  const h =
    (typeof node.height === "number" ? node.height : undefined) ??
    nodeStyleSize(node, "height") ??
    opts?.defaultNodeHeight ??
    280;
  return { x: node.position.x, y: node.position.y, w, h };
}

function placementFromGeometry(
  geometry: NodeFlowGeometry,
  minFlowWidth: number,
): LibtvDockFlowPlacement {
  return {
    flowX: geometry.x + geometry.w / 2,
    flowY: geometry.y + geometry.h + LIBTV_DOCK_GAP,
    flowW: Math.max(geometry.w, minFlowWidth),
  };
}

function selectStoreGeometry(
  nodes: CanvasFlowNode[],
  nodeId: string | null,
  opts?: PlacementOpts,
): NodeFlowGeometry | null {
  if (!nodeId) return null;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return geometryFromStoreNode(node, opts);
}

/**
 * 输入坞锚点（画布 flow 坐标 · 随节点拖动 / pan/zoom 实时更新）。
 * 订阅 React Flow nodeLookup，避免松手后 zustand 与 RF 短暂不同步导致定位偏移。
 * RF 裁剪未渲染节点时回退 zustand 坐标；equality 忽略 prompt 等 data 变更。
 */
export function useLibtvDockFlowPlacement(
  nodeId: string | null,
  opts?: PlacementOpts,
): LibtvDockFlowPlacement | null {
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

  const storeGeometry = useCanvasStore(
    useCallback(
      (s) => selectStoreGeometry(s.nodes, nodeId, opts),
      [nodeId, opts?.defaultNodeWidth, opts?.defaultNodeHeight],
    ),
    geometryEqual,
  );

  return useMemo(() => {
    if (!nodeId) return null;
    const resolved = geometry ?? storeGeometry;
    if (!resolved) return null;
    const minW = opts?.minFlowWidth ?? PRO2_DOCK_WIDTH;
    return placementFromGeometry(resolved, minW);
  }, [nodeId, geometry, storeGeometry, opts?.minFlowWidth]);
}

/** pan/zoom 或 RF 裁剪导致 placement 短暂为 null 时，保留上一帧锚点避免 Dock 卸载 */
export function useStableLibtvDockFlowPlacement(
  placement: LibtvDockFlowPlacement | null,
): LibtvDockFlowPlacement | null {
  const lastRef = useRef<LibtvDockFlowPlacement | null>(null);
  if (placement) lastRef.current = placement;
  return placement ?? lastRef.current;
}
