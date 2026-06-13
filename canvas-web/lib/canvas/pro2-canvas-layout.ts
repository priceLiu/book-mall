/**
 * 影视专业版 2.0 · 画布级重排：工作区模板 + 媒体组宫格 + 游离顶层网格
 */
import {
  applyNodePositions,
  CANVAS_REFLOW_ORIGIN,
  CANVAS_REFLOW_SECTION_GAP,
  packNodesInGrid,
  sortNodesForReflowPack,
  workspaceBlockBottom,
} from "./canvas-reflow-pack";
import {
  nodeMeasuredSize,
  sortNodesForReactFlow,
} from "./normalize-graph-nodes";
import { applyPro2MediaGroupRelayout } from "./pro2-media-group-layout";
import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { reflowStoryPro2Workspace } from "./story-pro2-workspace-layout";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const PRO2_WORKSPACE_TYPES = new Set([
  "story-pro2-starter",
  "story-pro2-script-hub",
  "story-pro2-style",
  "story-pro2-character",
  "story-pro2-scene",
  "story-pro2-frame",
  "story-pro2-video",
  "jianying-export-pro2",
]);

/** 工作区 + Pro2 媒体组 + 非工作区顶层节点 */
export function reflowPro2CanvasLayout(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  let next = reflowStoryPro2Workspace(nodes, edges, {
    origin: CANVAS_REFLOW_ORIGIN,
  });

  const groups = next.filter(
    (n) => n.type === "group" && isPro2StyledGroup(n, next),
  );
  for (const group of groups) {
    next = applyPro2MediaGroupRelayout(next, group.id);
  }

  const topLevel = next.filter((n) => !n.parentId);
  const free = topLevel.filter((n) => !PRO2_WORKSPACE_TYPES.has(n.type ?? ""));
  if (!free.length) return sortNodesForReactFlow(next);

  const packStartY =
    topLevel.some((n) => PRO2_WORKSPACE_TYPES.has(n.type ?? ""))
      ? workspaceBlockBottom(next, PRO2_WORKSPACE_TYPES) +
        CANVAS_REFLOW_SECTION_GAP
      : CANVAS_REFLOW_ORIGIN.y;

  const sorted = sortNodesForReflowPack(free);
  const positions = packNodesInGrid(
    next,
    sorted.map((n) => n.id),
    { startY: packStartY },
  );

  next = applyNodePositions(next, positions);
  return sortNodesForReactFlow(next);
}
