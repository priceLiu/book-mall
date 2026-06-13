/**
 * 影视专业版 2.0 · 薄卡工作区布局
 */
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import { nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";
import {
  findStoryPro2ScriptHubForStarter,
  findStoryPro2WorkspaceForStarter,
  reconcileStoryPro2Workspace,
} from "./spawn-story-pro2-workspace";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import { STORY_WORKSPACE_COL_H_GAP } from "./story-comic-workspace-layout";
import { storyProControlRowX } from "./story-pro-control-layout";
import { hasStoryPro2Pipeline } from "./story-pro2-pipeline";
import {
  PRO2_COLUMN_CARD_HEIGHT,
  PRO2_CONTROL_CARD_HEIGHT,
} from "./story-pro2-node-chrome";
import { CANVAS_REFLOW_ORIGIN } from "./canvas-reflow-pack";

export { hasStoryPro2Pipeline };

const PRO2_WORKSPACE_STACK_GAP = 80;

const PRO2_CONTROL_TYPES = new Set([
  "story-pro2-starter",
  "story-pro2-script-hub",
  "story-pro2-style",
]);

const PRO2_MEDIA_TYPES: CanvasNodeType[] = [
  "story-pro2-character",
  "story-pro2-scene",
  "story-pro2-frame",
  "story-pro2-video",
  "jianying-export-pro2",
];

function nodeReflowWidth(n: CanvasFlowNode): number {
  const { w } = nodeMeasuredSize(n);
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t]?.width ?? 0;
  return Math.max(w, def);
}

function placeNode(
  node: CanvasFlowNode,
  x: number,
  y: number,
): CanvasFlowNode {
  const w = nodeReflowWidth(node);
  const t = (node.type ?? "text") as CanvasNodeType;
  const h = NODE_DEFAULT_SIZE[t]?.height ?? PRO2_COLUMN_CARD_HEIGHT;
  return {
    ...node,
    position: { x, y },
    width: w,
    height: h,
    style: { ...(node.style ?? {}), width: w, height: h },
  } as CanvasFlowNode;
}

function mediaRowY(controlY: number): number {
  return controlY + PRO2_CONTROL_CARD_HEIGHT + 48;
}

function mediaColumnXs(originX: number): number[] {
  let x = originX;
  return PRO2_MEDIA_TYPES.map((t) => {
    const left = x;
    x += (NODE_DEFAULT_SIZE[t]?.width ?? 320) + STORY_WORKSPACE_COL_H_GAP;
    return left;
  });
}

export function reflowStoryPro2Workspace(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  opts?: { origin?: { x: number; y: number } },
): CanvasFlowNode[] {
  let next = reconcileStoryPro2Workspace(nodes);
  const starters = next.filter((n) => n.type === "story-pro2-starter");
  if (!starters.length) return sortNodesForReactFlow(next);

  const baseOrigin = opts?.origin ?? CANVAS_REFLOW_ORIGIN;
  const byId = new Map(next.map((n) => [n.id, n]));
  let stackY = baseOrigin.y;

  for (const starter of starters) {
    const stored = (starter.data as { workspaceIds?: StoryPro2WorkspaceIds })
      .workspaceIds;
    const hubLink = findStoryPro2ScriptHubForStarter(
      next,
      edges,
      starter.id,
      stored,
    );
    if (!hubLink) continue;
    const ws = findStoryPro2WorkspaceForStarter(
      next,
      edges,
      starter.id,
      stored,
    );
    if (!ws) continue;

    const originX = baseOrigin.x;
    const originY = stackY;
    const { hubX, styleX } = storyProControlRowX(originX);
    const rowY = mediaRowY(originY);
    const [charX, sceneX, frameX, videoX, exportX] = mediaColumnXs(originX);

    const patch = (id: string | undefined, x: number, y: number, type: CanvasNodeType) => {
      if (!id) return;
      const node = byId.get(id);
      if (!node || node.type !== type) return;
      byId.set(id, placeNode(node, x, y));
    };

    patch(starter.id, originX, originY, "story-pro2-starter");
    patch(ws.scriptHubId, hubX, originY, "story-pro2-script-hub");
    patch(ws.styleNodeId, styleX, originY, "story-pro2-style");
    patch(ws.characterColumnId, charX, rowY, "story-pro2-character");
    patch(ws.sceneColumnId, sceneX, rowY, "story-pro2-scene");
    patch(ws.frameColumnId, frameX, rowY, "story-pro2-frame");
    patch(ws.videoColumnId, videoX, rowY, "story-pro2-video");
    patch(ws.jianyingExportId, exportX, rowY, "jianying-export-pro2");

    const workspaceIds = [
      starter.id,
      ws.scriptHubId,
      ws.styleNodeId,
      ws.characterColumnId,
      ws.sceneColumnId,
      ws.frameColumnId,
      ws.videoColumnId,
      ws.jianyingExportId,
    ].filter(Boolean) as string[];
    let blockBottom = originY;
    for (const id of workspaceIds) {
      const node = byId.get(id);
      if (!node) continue;
      const { h } = nodeMeasuredSize(node);
      blockBottom = Math.max(blockBottom, node.position.y + h);
    }
    stackY = blockBottom + PRO2_WORKSPACE_STACK_GAP;
  }

  return sortNodesForReactFlow(Array.from(byId.values()));
}
