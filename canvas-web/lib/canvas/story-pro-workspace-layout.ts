/**
 * 影视专业版 · 工作区布局 reflow
 */
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import { nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";
import { applyStoryColumnHeights } from "./story-column-layout";
import {
  findStoryProScriptHubForStarter,
  findStoryProWorkspaceForStarter,
  reconcileStoryProHubFinalized,
} from "./spawn-story-pro-workspace";
import type { StoryProWorkspaceIds } from "./story-pro-workspace-types";
import { STORY_WORKSPACE_COL_H_GAP } from "./story-comic-workspace-layout";
import {
  storyControlRowBottom,
  storyMediaColumnY,
} from "./story-workspace-layout";
import { isStoryProPipelineNode } from "./types";
import {
  STORY_PRO_CONTROL_NODE_HEIGHT,
  STORY_PRO_CONTROL_NODE_WIDTH,
  STORY_PRO_STYLE_NODE_EXTRA_H,
} from "./story-pro-node-chrome";
import {
  storyProControlRowX,
  storyProMediaColumnStartX,
} from "./story-pro-control-layout";

export function hasStoryProPipeline(nodes: CanvasFlowNode[]): boolean {
  return nodes.some((n) => isStoryProPipelineNode(n.type ?? ""));
}

function nodeReflowWidth(n: CanvasFlowNode): number {
  const { w } = nodeMeasuredSize(n);
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t]?.width ?? 0;
  return Math.max(w, def);
}

function nodeReflowHeight(n: CanvasFlowNode): number {
  const { h } = nodeMeasuredSize(n);
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t]?.height ?? 0;
  return Math.max(h, def);
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

function proMediaColumnXs(controlAnchorLeftX: number): number[] {
  const types: CanvasNodeType[] = [
    "story-pro-character",
    "story-pro-scene",
    "story-pro-frame",
    "story-pro-video",
    "jianying-export-pro",
  ];
  let x = storyProMediaColumnStartX(controlAnchorLeftX);
  return types.map((t) => {
    const left = x;
    x += (NODE_DEFAULT_SIZE[t]?.width ?? 400) + STORY_WORKSPACE_COL_H_GAP;
    return left;
  });
}

export function reflowStoryProWorkspace(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  let next = reconcileStoryProHubFinalized(nodes);
  const starters = next.filter((n) => n.type === "story-pro-starter");
  if (!starters.length) return next;

  for (const starter of starters) {
    const stored = (starter.data as { workspaceIds?: StoryProWorkspaceIds })
      .workspaceIds;
    const hubLink = findStoryProScriptHubForStarter(
      next,
      edges,
      starter.id,
      stored,
    );
    if (!hubLink) continue;
    const ws = findStoryProWorkspaceForStarter(
      next,
      edges,
      starter.id,
      stored,
    );
    if (!ws) continue;

    const originY = starter.position.y ?? 120;
    const originX = starter.position.x ?? 80;
    const { hubX, styleX } = storyProControlRowX(originX);
    const rowBottom = storyControlRowBottom(originY);

    const hub = next.find((n) => n.id === ws.scriptHubId);
    const style = ws.styleNodeId
      ? next.find((n) => n.id === ws.styleNodeId)
      : undefined;

    const controlAnchorX = style ? styleX : hubX;
    const [charX, sceneX, frameX, videoX, exportX] =
      proMediaColumnXs(controlAnchorX);

    next = next.map((n) =>
      n.id === starter.id
        ? applyNodeHeight(
            placeNode(n, originX, originY),
            STORY_PRO_CONTROL_NODE_HEIGHT,
          )
        : n,
    );

    if (hub) {
      next = next.map((n) =>
        n.id === hub.id
          ? applyNodeHeight(
              placeNode(n, hubX, originY),
              STORY_PRO_CONTROL_NODE_HEIGHT,
            )
          : n,
      );
    }
    if (style) {
      next = next.map((n) =>
        n.id === style.id
          ? applyNodeHeight(
              placeNode(n, styleX, originY),
              STORY_PRO_CONTROL_NODE_HEIGHT + STORY_PRO_STYLE_NODE_EXTRA_H,
            )
          : n,
      );
    }

    const place = (id: string | undefined, x: number, type: CanvasNodeType) => {
      if (!id) return;
      const node = next.find((n) => n.id === id);
      if (!node) return;
      const y =
        type === "jianying-export-pro"
          ? originY
          : storyMediaColumnY(originY, rowBottom, type);
      next = next.map((n) => (n.id === id ? placeNode(n, x, y) : n));
    };

    place(ws.characterColumnId, charX, "story-pro-character");
    place(ws.sceneColumnId, sceneX, "story-pro-scene");
    place(ws.frameColumnId, frameX, "story-pro-frame");
    place(ws.videoColumnId, videoX, "story-pro-video");
    place(ws.jianyingExportId, exportX, "jianying-export-pro");
  }

  next = applyStoryColumnHeights(next);
  return sortNodesForReactFlow(next);
}
