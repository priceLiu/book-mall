import type { Connection } from "@xyflow/react";
import { nodeSnapBox } from "./canvas-drag-snap";
import { absoluteNodePosition, nodeMeasuredSize } from "./normalize-graph-nodes";
import type { CanvasFlowNode } from "./types";

/** 拖线松手时 · 节点 type → 默认 target / source handle */
export const DEFAULT_HANDLE_BY_TYPE: Record<
  string,
  { target?: string; source?: string }
> = {
  "sbv1-image": { target: "in_image", source: "image" },
  "sbv1-video-engine": { target: "in_ref", source: "out_video" },
  "jianying-export-pro2": { target: "in_video" },
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
    if (
      point.x < box.left - CONNECT_SNAP_PADDING ||
      point.x > box.right + CONNECT_SNAP_PADDING ||
      point.y < box.top - CONNECT_SNAP_PADDING ||
      point.y > box.bottom + CONNECT_SNAP_PADDING
    ) {
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
        ? n.type === "jianying-export-pro2"
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

  const targetNode =
    (state.toNodeId
      ? nodes.find((n) => n.id === state.toNodeId)
      : null) ??
    findTopmostNodeAtFlowPoint(nodes, flowPoint, state.fromNodeId);
  if (!targetNode || targetNode.id === state.fromNodeId) return null;

  const needRole: "source" | "target" =
    state.fromHandleType === "source" ? "target" : "source";

  const toDefaults = DEFAULT_HANDLE_BY_TYPE[String(targetNode.type ?? "")];

  const fromNode = nodes.find((n) => n.id === state.fromNodeId);

  if (state.fromHandleType === "source") {
    let targetHandle =
      state.toHandleId ??
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
      targetNode.type === "jianying-export-pro2" &&
      !state.toHandleId &&
      fromNode?.type === "sbv1-video-engine" &&
      state.fromHandleId === "out_video"
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
