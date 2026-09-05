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
import { PRO2_MEDIA_GROUP_LAYOUT_VERSION } from "./pro2-media-group-layout";

/** 打开项目 / 手动重排：仅迁移 layoutVersion 落后的 sbv1 媒体组 */
export function relayoutStaleSbv1MediaGroups(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  opts?: { force?: boolean },
): CanvasFlowNode[] {
  let next = nodes;
  for (const group of nodes) {
    if (group.type !== "group") continue;
    if (Boolean((group.data as { manualSize?: boolean }).manualSize)) continue;
    if (!isSbv1MediaGroup(group, next)) continue;
    const version =
      (group.data as { pro2LayoutVersion?: number }).pro2LayoutVersion ?? 0;
    if (!opts?.force && version >= PRO2_MEDIA_GROUP_LAYOUT_VERSION) continue;
    next = applySbv1MediaGroupRelayout(next, edges, group.id);
  }
  return next;
}

export function reflowSbv1Canvas(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  let next = relayoutStaleSbv1MediaGroups(nodes, edges, { force: true });
  const groups = next.filter(
    (n) => n.type === "group" && isSbv1MediaGroup(n, next),
  );
  for (const group of groups) {
    if (Boolean((group.data as { manualSize?: boolean }).manualSize)) continue;
    next = applySbv1MediaGroupRelayout(next, edges, group.id);
  }

  const topLevel = next.filter((n) => !n.parentId);
  const loose = topLevel.filter((n) => n.type !== "group");
  if (!loose.length) return sortNodesForReactFlow(next);

  const sorted = sortNodesForReflowPack(loose);
  const positions = packNodesInGrid(
    next,
    sorted.map((n) => n.id),
    { startY: CANVAS_REFLOW_ORIGIN.y },
  );

  next = applyNodePositions(next, positions);
  return sortNodesForReactFlow(next);
}
