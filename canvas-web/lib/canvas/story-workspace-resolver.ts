/**
 * Hub-scoped starter / workspace 解析 — 快手版与专业版共用
 */
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { StoryWorkspaceIds } from "./story-workspace-types";
import type { StoryProWorkspaceIds } from "./story-pro-workspace-types";
import { isStoryProNodeType } from "./story-pro-workspace-types";

const COMIC_STARTER = "story-comic-starter";
const PRO_STARTER = "story-pro-starter";

export function resolveStarterForHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubNodeId: string,
): CanvasFlowNode | undefined {
  for (const n of nodes) {
    if (n.type !== COMIC_STARTER && n.type !== PRO_STARTER) continue;
    const ws = (
      n.data as { workspaceIds?: StoryWorkspaceIds | StoryProWorkspaceIds }
    ).workspaceIds;
    if (ws?.scriptHubId === hubNodeId) return n;
  }
  for (const e of edges) {
    if (e.target !== hubNodeId) continue;
    const src = nodes.find((n) => n.id === e.source);
    if (src?.type === COMIC_STARTER || src?.type === PRO_STARTER) return src;
  }
  return undefined;
}

export function isProWorkflowHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubNodeId: string,
): boolean {
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (hub && isStoryProNodeType(hub.type ?? "")) return true;
  const starter = resolveStarterForHub(nodes, edges, hubNodeId);
  return starter?.type === PRO_STARTER;
}

export function findProStyleForHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  scriptHubId: string,
): CanvasFlowNode | undefined {
  const direct = nodes.find(
    (n) =>
      n.type === "story-pro-style" &&
      (n.data as { hubNodeId?: string }).hubNodeId === scriptHubId,
  );
  if (direct) return direct;
  return edges
    .filter((e) => e.source === scriptHubId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === "story-pro-style");
}

/** 风格节点 → 所属故事剧本 hub（data.hubNodeId 或入边） */
export function findProScriptHubForStyle(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  styleNodeId: string,
  hubNodeId?: string,
): CanvasFlowNode | undefined {
  if (hubNodeId) {
    const hub = nodes.find((n) => n.id === hubNodeId);
    if (hub?.type === "story-pro-script-hub") return hub;
  }
  return edges
    .filter((e) => e.target === styleNodeId)
    .map((e) => nodes.find((n) => n.id === e.source))
    .find((n) => n?.type === "story-pro-script-hub");
}

export function findStarterByHubId(
  nodes: CanvasFlowNode[],
  hubNodeId: string,
): CanvasFlowNode | undefined {
  for (const n of nodes) {
    if (n.type !== "story-comic-starter" && n.type !== "story-pro-starter") {
      continue;
    }
    const ws = (
      n.data as { workspaceIds?: { scriptHubId?: string } }
    ).workspaceIds;
    if (ws?.scriptHubId === hubNodeId) return n;
  }
  return resolveStarterForHub(nodes, [], hubNodeId);
}

export function isAnyStoryScriptHubType(t: string): boolean {
  return t === "story-script-hub" || t === "story-pro-script-hub";
}

export function isAnyStoryCharacterColumnType(t: string): boolean {
  return t === "story-character-column" || t === "story-pro-character";
}

export function isAnyStoryFrameColumnType(t: string): boolean {
  return t === "story-frame-column" || t === "story-pro-frame";
}

export function isAnyStoryVideoColumnType(t: string): boolean {
  return t === "story-video-column" || t === "story-pro-video";
}

export function storyProStyleFinalized(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  scriptHubId: string,
): boolean {
  const style = findProStyleForHub(nodes, edges, scriptHubId);
  if (!style) return false;
  return Boolean(
    (style.data as { styleFinalized?: boolean }).styleFinalized,
  );
}
