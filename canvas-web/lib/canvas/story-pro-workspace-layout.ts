/**
 * 影视专业版 · 工作区布局 reflow
 */
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import { nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";
import { applyStoryColumnHeights } from "./story-column-layout";
import {
  STORY_CONTROL_NODE_HEIGHT,
  STORY_CONTROL_NODE_WIDTH,
} from "./story-node-chrome";
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

function proMediaColumnXs(hubLeftX: number): number[] {
  const types: CanvasNodeType[] = [
    "story-pro-character",
    "story-pro-scene",
    "story-pro-frame",
    "story-pro-video",
    "jianying-export-pro",
  ];
  let x = hubLeftX + STORY_CONTROL_NODE_WIDTH + STORY_WORKSPACE_COL_H_GAP;
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
    const hub = next.find((n) => n.id === ws.scriptHubId);
    const style = ws.styleNodeId
      ? next.find((n) => n.id === ws.styleNodeId)
      : undefined;
    const hubLeftX = style?.position.x ?? hub?.position.x ?? 560;
    const rowBottom = storyControlRowBottom(originY);
    const [charX, sceneX, frameX, videoX, exportX] = proMediaColumnXs(hubLeftX);

    const place = (id: string | undefined, x: number, type: CanvasNodeType) => {
      if (!id) return;
      const idx = next.findIndex((n) => n.id === id);
      if (idx < 0) return;
      const y =
        type === "jianying-export-pro"
          ? originY
          : storyMediaColumnY(originY, rowBottom, type);
      next[idx] = {
        ...next[idx]!,
        position: { x, y },
        width: nodeReflowWidth(next[idx]!),
        height: nodeReflowHeight(next[idx]!),
      } as CanvasFlowNode;
    };

    if (hub) {
      const hi = next.findIndex((n) => n.id === hub.id);
      next[hi] = applyNodeHeight(
        {
          ...next[hi]!,
          position: { x: starter.position.x + 480, y: originY },
        } as CanvasFlowNode,
        STORY_CONTROL_NODE_HEIGHT,
      );
    }
    if (style) {
      const si = next.findIndex((n) => n.id === style.id);
      next[si] = applyNodeHeight(
        {
          ...next[si]!,
          position: { x: (hub?.position.x ?? 560) + 480, y: originY },
        } as CanvasFlowNode,
        STORY_CONTROL_NODE_HEIGHT + 80,
      );
    }

    place(ws.characterColumnId, charX, "story-pro-character");
    place(ws.sceneColumnId, sceneX, "story-pro-scene");
    place(ws.frameColumnId, frameX, "story-pro-frame");
    place(ws.videoColumnId, videoX, "story-pro-video");
    place(ws.jianyingExportId, exportX, "jianying-export-pro");
  }

  next = applyStoryColumnHeights(next);
  return sortNodesForReactFlow(next);
}
