import type { Connection } from "@xyflow/react";
import { nodeSnapBox } from "./canvas-drag-snap";
import { absoluteNodePosition, nodeMeasuredSize } from "./normalize-graph-nodes";
import { SIDE_PLUS_BY_TYPE } from "./libtv-side-connect-menu";
import { libtvSidePlusInHandleId } from "./libtv-side-plus-in-handle";
import {
  LIBTV_SIDE_PLUS_LG_RADIUS_FLOW,
  LIBTV_SIDE_PLUS_SNAP_PADDING_FLOW,
} from "./libtv-node-chrome";
import type { CanvasFlowNode } from "./types";

/** 拖线松手时 · 节点 type → 默认 target / source handle */
export const DEFAULT_HANDLE_BY_TYPE: Record<
  string,
  { target?: string; source?: string }
> = {
  "sbv1-image": { target: "in_image", source: "image" },
  "sbv1-video-engine": { target: "in_ref", source: "out_video" },
  "jianying-export-pro2": { target: "in_video" },
  "jianying-auto-render-pro2": { target: "in_video" },
  "story-pro2-image": { target: "in_image", source: "image" },
  "story-pro2-three-view": { target: "in_image", source: "image" },
  "story-pro2-starter": { target: "in_text", source: "text" },
  "story-pro2-script-hub": { target: "in_text", source: "text" },
  "story-pro2-frame": { target: "in_text" },
  "story-pro2-character": { target: "in_text" },
  group: { target: "in_text", source: "out_media" },
};

export function findTopmostNodeAtFlowPoint(
  nodes: CanvasFlowNode[],
  point: { x: number; y: number },
  excludeId?: string,
): CanvasFlowNode | null {
  const hits: { node: CanvasFlowNode; area: number; z: number }[] = [];
  for (const n of nodes) {
    if (n.id === excludeId) continue;
    if (n.type === "group") continue;
    const box = nodeSnapBox(n, nodes);
    const inBox =
      point.x >= box.left - CONNECT_SNAP_PADDING &&
      point.x <= box.right + CONNECT_SNAP_PADDING &&
      point.y >= box.top - CONNECT_SNAP_PADDING &&
      point.y <= box.bottom + CONNECT_SNAP_PADDING;
    const onSidePlus = nodeHitsSidePlusZone(n, nodes, point);
    if (!inBox && !onSidePlus) {
      continue;
    }
    const { w, h } = nodeMeasuredSize(n);
    hits.push({
      node: n,
      area: w * h,
      z: typeof n.zIndex === "number" ? n.zIndex : 0,
    });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.z - a.z || a.area - b.area);
  return hits[0]!.node;
}

function pickHandleId(
  node: CanvasFlowNode,
  role: "source" | "target",
): string | undefined {
  const defaults = DEFAULT_HANDLE_BY_TYPE[String(node.type ?? "")];
  return role === "target" ? defaults?.target : defaults?.source;
}

export type SnapConnectionEndArgs = {
  fromNodeId?: string | null;
  fromHandleId?: string | null;
  fromHandleType?: "source" | "target" | null;
  toNodeId?: string | null;
  toHandleId?: string | null;
  isValid?: boolean;
};

/** 松手点距节点外框的吸附容差（px · 画布坐标） */
const CONNECT_SNAP_PADDING = 28;

type SidePlusSnapHit = {
  node: CanvasFlowNode;
  handleId: string;
  dist: number;
};

/** 与 pro2-node-side-plus · MAGNET_VERTICAL_INSET_PX 对齐 */
const SIDE_PLUS_VERTICAL_INSET_FLOW = 24;

/** 点到侧 + 吸附带的最短距离（+ 可沿节点竖边磁吸移动） */
function distancePointToSidePlusZone(
  point: { x: number; y: number },
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  side: "left" | "right",
): number | null {
  const map = SIDE_PLUS_BY_TYPE[String(node.type ?? "")];
  if (!map) return null;
  const handleId = side === "left" ? map.left : map.right;
  if (!handleId) return null;
  const box = nodeSnapBox(node, nodes);
  const cx =
    side === "left"
      ? box.left - LIBTV_SIDE_PLUS_LG_RADIUS_FLOW
      : box.right + LIBTV_SIDE_PLUS_LG_RADIUS_FLOW;
  const minY = box.top + SIDE_PLUS_VERTICAL_INSET_FLOW;
  const maxY = box.bottom - SIDE_PLUS_VERTICAL_INSET_FLOW;
  if (maxY <= minY) return null;
  const clampedY = Math.max(minY, Math.min(maxY, point.y));
  return Math.hypot(point.x - cx, point.y - clampedY);
}

export function findNearestSidePlusHandle(
  nodes: CanvasFlowNode[],
  point: { x: number; y: number },
  excludeId?: string,
): SidePlusSnapHit | null {
  let best: SidePlusSnapHit | null = null;
  const maxDist =
    LIBTV_SIDE_PLUS_LG_RADIUS_FLOW + LIBTV_SIDE_PLUS_SNAP_PADDING_FLOW;

  for (const n of nodes) {
    if (n.id === excludeId || n.type === "group") continue;
    const map = SIDE_PLUS_BY_TYPE[String(n.type ?? "")];
    if (!map) continue;

    for (const side of ["left", "right"] as const) {
      const handleId = side === "left" ? map.left : map.right;
      if (!handleId) continue;
      const dist = distancePointToSidePlusZone(point, n, nodes, side);
      if (dist == null || dist > maxDist) continue;
      const snapHandleId =
        side === "left" || side === "right"
          ? libtvSidePlusInHandleId(handleId)
          : handleId;
      if (!best || dist < best.dist) {
        best = { node: n, handleId: snapHandleId, dist };
      }
    }
  }
  return best;
}

function nodeHitsSidePlusZone(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  point: { x: number; y: number },
): boolean {
  const map = SIDE_PLUS_BY_TYPE[String(node.type ?? "")];
  if (!map) return false;
  const maxDist =
    LIBTV_SIDE_PLUS_LG_RADIUS_FLOW + LIBTV_SIDE_PLUS_SNAP_PADDING_FLOW;
  for (const side of ["left", "right"] as const) {
    const handleId = side === "left" ? map.left : map.right;
    if (!handleId) continue;
    const dist = distancePointToSidePlusZone(point, node, nodes, side);
    if (dist != null && dist <= maxDist) {
      return true;
    }
  }
  return false;
}

function distancePointToRect(
  point: { x: number; y: number },
  box: { left: number; top: number; right: number; bottom: number },
): number {
  const dx =
    point.x < box.left
      ? box.left - point.x
      : point.x > box.right
        ? point.x - box.right
        : 0;
  const dy =
    point.y < box.top
      ? box.top - point.y
      : point.y > box.bottom
        ? point.y - box.bottom
        : 0;
  return Math.hypot(dx, dy);
}

/** 框选批量连线 · 按模式吸附目标节点外框 */
export function findBatchConnectSnapTarget(
  nodes: CanvasFlowNode[],
  flowPoint: { x: number; y: number },
  excludeIds: string[],
  mode: "video-export" | "image-pipeline" = "video-export",
): CanvasFlowNode | null {
  const exclude = new Set(excludeIds);
  let nearest: { node: CanvasFlowNode; dist: number } | null = null;

  for (const n of nodes) {
    if (exclude.has(n.id)) continue;
    const matches =
      mode === "video-export"
        ? n.type === "jianying-export-pro2" ||
          n.type === "jianying-auto-render-pro2"
        : n.type === "sbv1-video-engine" ||
          n.type === "sbv1-image" ||
          n.type === "story-pro2-image" ||
          n.type === "story-pro2-three-view";
    if (!matches) continue;
    const box = nodeSnapBox(n, nodes);
    const dist = distancePointToRect(flowPoint, box);
    if (
      dist <= CONNECT_SNAP_PADDING * 2 &&
      (!nearest || dist < nearest.dist)
    ) {
      nearest = { node: n, dist };
    }
  }
  if (nearest) return nearest.node;

  return findTopmostNodeAtFlowPoint(nodes, flowPoint, excludeIds[0]);
}

/** 拖线未命中 Handle 但落在节点上时，补全连线 */
export function resolveSnapConnectionOnNodeHit(
  state: SnapConnectionEndArgs,
  nodes: CanvasFlowNode[],
  flowPoint: { x: number; y: number },
): Connection | null {
  if (state.isValid) return null;
  if (!state.fromNodeId || !state.fromHandleId || !state.fromHandleType) {
    return null;
  }

  const sidePlusHit = findNearestSidePlusHandle(
    nodes,
    flowPoint,
    state.fromNodeId,
  );

  const targetNode =
    sidePlusHit?.node ??
    (state.toNodeId
      ? nodes.find((n) => n.id === state.toNodeId)
      : null) ??
    findTopmostNodeAtFlowPoint(nodes, flowPoint, state.fromNodeId);
  if (!targetNode || targetNode.id === state.fromNodeId) return null;

  const toDefaults = DEFAULT_HANDLE_BY_TYPE[String(targetNode.type ?? "")];

  const fromNode = nodes.find((n) => n.id === state.fromNodeId);

  if (state.fromHandleType === "source") {
    let targetHandle =
      state.toHandleId ??
      (sidePlusHit?.node.id === targetNode.id
        ? sidePlusHit.handleId
        : undefined) ??
      pickHandleId(targetNode, "target") ??
      toDefaults?.target;
    if (
      targetNode.type === "sbv1-video-engine" &&
      !state.toHandleId &&
      (fromNode?.type === "story-pro2-starter" ||
        fromNode?.type === "story-pro2-script-hub")
    ) {
      targetHandle = "in_text";
    } else if (
      targetNode.type === "sbv1-video-engine" &&
      !state.toHandleId &&
      fromNode?.type === "sbv1-video-engine" &&
      state.fromHandleId === "out_video"
    ) {
      targetHandle = "in_motion_video";
    } else if (
      (targetNode.type === "jianying-export-pro2" ||
        targetNode.type === "jianying-auto-render-pro2") &&
      !state.toHandleId &&
      fromNode?.type === "sbv1-video-engine" &&
      (state.fromHandleId === "out_video" || state.fromHandleId === "plus_left")
    ) {
      targetHandle = "in_video";
    }
    if (!targetHandle) return null;
    return {
      source: state.fromNodeId,
      target: targetNode.id,
      sourceHandle: state.fromHandleId,
      targetHandle,
    };
  }

  const sourceHandle =
    state.toHandleId ??
    (sidePlusHit?.node.id === targetNode.id ? sidePlusHit.handleId : undefined) ??
    pickHandleId(targetNode, "source") ??
    toDefaults?.source;
  if (!sourceHandle) return null;
  return {
    source: targetNode.id,
    target: state.fromNodeId,
    sourceHandle,
    targetHandle: state.fromHandleId,
  };
}

/** 节点外框 · 供调试 / 扩展 */
export function nodeFlowBounds(
  n: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): { x: number; y: number; w: number; h: number } {
  const abs = absoluteNodePosition(n, nodes);
  const { w, h } = nodeMeasuredSize(n);
  return { x: abs.x, y: abs.y, w, h };
}
