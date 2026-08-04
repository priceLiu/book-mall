import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 高于组框 (5)、低于媒体子节点 (22) · 组内/入组连线在此层可见 */
export const CANVAS_EDGE_Z_NODE_GAP = 12;
/** @deprecated 用 CANVAS_EDGE_Z_NODE_GAP */
export const CANVAS_EDGE_Z_INTERNAL_GROUP = CANVAS_EDGE_Z_NODE_GAP;
/** @deprecated 跨组不再压到组框下，否则入组/组内线段整段被组底色吃掉 */
export const CANVAS_EDGE_Z_BEHIND_GROUP = 4;
/** 画布外普通连线 · 与组内同层 */
export const CANVAS_EDGE_Z_DEFAULT = CANVAS_EDGE_Z_NODE_GAP;

/** @deprecated 用 CANVAS_EDGE_Z_NODE_GAP */
export const CANVAS_EDGE_Z_ABOVE_GROUP = CANVAS_EDGE_Z_NODE_GAP;

type EdgeEndpoints = Pick<CanvasFlowEdge, "source" | "target">;

function edgeEndpointNodes(
  edge: EdgeEndpoints,
  nodes: CanvasFlowNode[],
): { src?: CanvasFlowNode; tgt?: CanvasFlowNode } {
  return {
    src: nodes.find((n) => n.id === edge.source),
    tgt: nodes.find((n) => n.id === edge.target),
  };
}

function isStyledMediaGroup(
  group: CanvasFlowNode | undefined,
  nodes: CanvasFlowNode[],
): boolean {
  if (!group || group.type !== "group") return false;
  return isPro2StyledGroup(group, nodes) || isSbv1MediaGroup(group, nodes);
}

/** 同源 group parentId · 组内任意子节点连线 */
export function isEdgeInternalToGroup(
  edge: EdgeEndpoints,
  nodes: CanvasFlowNode[],
): boolean {
  const { src, tgt } = edgeEndpointNodes(edge, nodes);
  if (!src?.parentId || !tgt?.parentId || src.parentId !== tgt.parentId) {
    return false;
  }
  const parent = nodes.find((n) => n.id === src.parentId);
  return parent?.type === "group";
}

/** 同源媒体组 parentId · 组内图↔视频等连线 */
export function isEdgeInternalToStyledMediaGroup(
  edge: EdgeEndpoints,
  nodes: CanvasFlowNode[],
): boolean {
  if (!isEdgeInternalToGroup(edge, nodes)) return false;
  const { src } = edgeEndpointNodes(edge, nodes);
  const group = nodes.find((n) => n.id === src?.parentId);
  return isStyledMediaGroup(group, nodes);
}

/** 端点 parentId 不一致 · 跨组或组↔画布外 */
export function isEdgeCrossingGroupBoundary(
  edge: EdgeEndpoints,
  nodes: CanvasFlowNode[],
): boolean {
  const { src, tgt } = edgeEndpointNodes(edge, nodes);
  const sp = src?.parentId ?? null;
  const tp = tgt?.parentId ?? null;
  return sp !== tp;
}

/** 任一端在 group 子节点上（含跨组入组/出组） */
export function isEdgeTouchingGroupedNode(
  edge: EdgeEndpoints,
  nodes: CanvasFlowNode[],
): boolean {
  const { src, tgt } = edgeEndpointNodes(edge, nodes);
  return Boolean(src?.parentId || tgt?.parentId);
}

export function canvasEdgeLayerClassName(zIndex: number): string | undefined {
  if (zIndex === CANVAS_EDGE_Z_NODE_GAP) {
    return "canvas-edge-node-gap";
  }
  if (zIndex === CANVAS_EDGE_Z_BEHIND_GROUP) {
    return "canvas-edge-behind-group";
  }
  return undefined;
}

/**
 * LibTV 画布连线分层：统一 z=12（高于组框 5、低于子节点 22）。
 * 组内/跨组入组须可见；不再把跨组线压到 z=4，否则在组区域整段被组底色遮住。
 */
export function resolveLibtvCanvasEdgeZIndex(
  edge: CanvasFlowEdge,
  nodes: CanvasFlowNode[],
  focusNodeIds?: Set<string> | null,
): number {
  if (
    focusNodeIds?.size &&
    (focusNodeIds.has(edge.source) || focusNodeIds.has(edge.target))
  ) {
    return CANVAS_EDGE_Z_NODE_GAP;
  }
  if (
    isEdgeInternalToGroup(edge, nodes) ||
    isEdgeCrossingGroupBoundary(edge, nodes) ||
    isEdgeTouchingGroupedNode(edge, nodes)
  ) {
    return CANVAS_EDGE_Z_NODE_GAP;
  }
  return CANVAS_EDGE_Z_DEFAULT;
}
