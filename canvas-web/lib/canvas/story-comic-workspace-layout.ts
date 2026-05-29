import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import { nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";
import { reconcileStoryVideoColumnRows } from "./story-column-display";
import { applyStoryColumnHeights } from "./story-column-layout";
import { hasStoryComicPipeline } from "./story-comic-layout";
import {
  STORY_CONTROL_NODE_HEIGHT,
  STORY_CONTROL_NODE_WIDTH,
} from "./story-node-chrome";
import {
  findStoryScriptHubForStarter,
  findWorkspaceForScriptHub,
  reconcileStoryStarterWorkspaces,
  reconcileStoryHubFinalized,
  resolveJianyingExportId,
} from "./spawn-story-workspace";
import type { StoryWorkspaceIds } from "./story-workspace-types";
import {
  STORY_WORKSPACE_COL_H_GAP,
  storyControlRowBottom,
  storyMediaColumnXs,
  storyMediaColumnY,
} from "./story-workspace-layout";

export { STORY_WORKSPACE_COL_H_GAP };

/** 重排横向步进：取 style/width、RF measured、类型默认宽度的最大值 */
function nodeReflowWidth(n: CanvasFlowNode): number {
  const { w } = nodeMeasuredSize(n);
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t]?.width ?? 0;
  const measured = (n as { measured?: { width?: number } }).measured?.width;
  return Math.max(w, def, measured ?? 0);
}

function nodeReflowHeight(n: CanvasFlowNode): number {
  const { h } = nodeMeasuredSize(n);
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t]?.height ?? 0;
  const measured = (n as { measured?: { height?: number } }).measured?.height;
  return Math.max(h, def, measured ?? 0);
}

function applyNodeHeight(n: CanvasFlowNode, height: number): CanvasFlowNode {
  const width = nodeReflowWidth(n);
  return {
    ...n,
    width,
    height,
    style: { ...(n.style ?? {}), width, height },
  } as CanvasFlowNode;
}

function applyStoryControlRowHeights(nodes: CanvasFlowNode[]): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (n.type !== "story-comic-starter" && n.type !== "story-script-hub") {
      return n;
    }
    return applyNodeHeight(
      { ...n, style: { ...(n.style ?? {}), width: STORY_CONTROL_NODE_WIDTH } } as CanvasFlowNode,
      STORY_CONTROL_NODE_HEIGHT,
    );
  });
}

function placeNode(
  node: CanvasFlowNode,
  x: number,
  y: number,
): CanvasFlowNode {
  const w = nodeReflowWidth(node);
  const h = nodeReflowHeight(node);
  return {
    ...node,
    position: { x, y },
    width: w,
    height: h,
    style: { ...(node.style ?? {}), width: w, height: h },
  } as CanvasFlowNode;
}

function resolveStarterWorkspace(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starter: CanvasFlowNode,
): StoryWorkspaceIds | null {
  const stored = (starter.data as { workspaceIds?: StoryWorkspaceIds })
    .workspaceIds;
  const hubLink = findStoryScriptHubForStarter(
    nodes,
    edges,
    starter.id,
    stored,
  );
  if (!hubLink) return null;
  return findWorkspaceForScriptHub(nodes, edges, hubLink.scriptHubId);
}

/** 单套工作流：主题 → 大纲 → 角色列 → 分镜列 → 视频列 → 剪映 */
function reflowStarterChain(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterId: string,
): CanvasFlowNode[] {
  const starter = nodes.find((n) => n.id === starterId);
  if (!starter || starter.type !== "story-comic-starter") return nodes;

  const ws = resolveStarterWorkspace(nodes, edges, starter);
  const hubId = ws?.scriptHubId;
  const origin = starter.position;
  const rowBottom = storyControlRowBottom(origin.y);

  let next = nodes;

  next = next.map((n) =>
    n.id === starterId
      ? placeNode(n, origin.x, origin.y)
      : n,
  );

  if (hubId) {
    const hubX = origin.x + STORY_CONTROL_NODE_WIDTH + STORY_WORKSPACE_COL_H_GAP;
    const hubY = origin.y;
    next = next.map((n) =>
      n.id === hubId ? placeNode(n, hubX, hubY) : n,
    );

    const [charX, frameX, videoX, jianyingX] = storyMediaColumnXs(hubX);
    const jianyingId = resolveJianyingExportId(next, edges, hubId, ws);
    const placements: Array<{ id?: string; x: number; type: CanvasNodeType }> =
      [
        { id: ws?.characterColumnId, x: charX, type: "story-character-column" },
        { id: ws?.frameColumnId, x: frameX, type: "story-frame-column" },
        { id: ws?.videoColumnId, x: videoX, type: "story-video-column" },
        { id: jianyingId, x: jianyingX, type: "jianying-export" },
      ];

    for (const p of placements) {
      if (!p.id) continue;
      const node = next.find((n) => n.id === p.id);
      if (!node) continue;
      const y = storyMediaColumnY(origin.y, rowBottom, p.type);
      next = next.map((n) => (n.id === p.id ? placeNode(n, p.x, y) : n));
    }
  }

  return next;
}

/** 漫剧工作流：按每套 story-comic-starter 独立重排（多工作流互不干扰） */
export function reflowStoryComicWorkspace(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): CanvasFlowNode[] {
  if (!hasStoryComicPipeline(nodes)) return nodes;

  let next = reconcileStoryStarterWorkspaces(nodes, edges);
  next = reconcileStoryHubFinalized(next, edges);
  next = applyStoryColumnHeights(reconcileStoryVideoColumnRows(next, edges), edges);
  next = applyStoryControlRowHeights(next);

  const starters = next.filter((n) => n.type === "story-comic-starter");
  for (const starter of starters) {
    next = reflowStarterChain(next, edges, starter.id);
  }

  return sortNodesForReactFlow(next);
}
