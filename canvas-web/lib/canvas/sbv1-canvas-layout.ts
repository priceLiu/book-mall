/**
 * 分镜视频 1.0 · 画布级重排：各媒体组内宫格 + 顶层节点网格收拢
 */
import {
  applyNodePositions,
  CANVAS_REFLOW_ORIGIN,
  packNodesInGrid,
  sortNodesForReflowPack,
} from "./canvas-reflow-pack";
import {
  nodeMeasuredSize,
  sortNodesForReactFlow,
} from "./normalize-graph-nodes";
import { applySbv1MediaGroupRelayout } from "./sbv1-media-group-layout";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export function reflowSbv1Canvas(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  let next = nodes;
  const groups = next.filter(
    (n) => n.type === "group" && isSbv1MediaGroup(n, next),
  );
  for (const group of groups) {
    next = applySbv1MediaGroupRelayout(next, edges, group.id);
  }

  const topLevel = next.filter((n) => !n.parentId);
  if (!topLevel.length) return sortNodesForReactFlow(next);

  const sorted = sortNodesForReflowPack(topLevel);
  const positions = packNodesInGrid(
    next,
    sorted.map((n) => n.id),
    { startY: CANVAS_REFLOW_ORIGIN.y },
  );

  next = applyNodePositions(next, positions);
  return sortNodesForReactFlow(next);
}
