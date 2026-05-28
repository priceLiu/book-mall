import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { findWorkspaceForScriptHub } from "./spawn-story-workspace";
import { findStoryProWorkspaceForStarter } from "./spawn-story-pro-workspace";
import type { StoryProWorkspaceIds } from "./story-pro-workspace-types";
import type { StoryWorkspaceIds } from "./story-workspace-types";

const COMIC_STEPS: CanvasFlowNode["type"][] = [
  "story-script-hub",
  "story-character-column",
  "story-frame-column",
  "story-video-column",
  "jianying-export",
];

const PRO_STEPS: CanvasFlowNode["type"][] = [
  "story-pro-script-hub",
  "story-pro-style",
  "story-pro-character",
  "story-pro-scene",
  "story-pro-frame",
  "story-pro-video",
  "jianying-export-pro",
];

function isStoryPipelineType(type: string | undefined): boolean {
  if (!type) return false;
  return (
    COMIC_STEPS.includes(type as (typeof COMIC_STEPS)[number]) ||
    PRO_STEPS.includes(type as (typeof PRO_STEPS)[number])
  );
}

function edgeWalk(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  fromId: string,
  expectedType: CanvasFlowNode["type"],
): CanvasFlowNode | undefined {
  return edges
    .filter((e) => e.source === fromId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === expectedType);
}

function buildProChain(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  stored?: StoryProWorkspaceIds | null,
): CanvasFlowNode[] {
  const hub = nodes.find((n) => n.id === hubId);
  if (!hub || hub.type !== "story-pro-script-hub") return [];

  const byId = (id?: string) =>
    id ? nodes.find((n) => n.id === id) : undefined;

  const style =
    byId(stored?.styleNodeId) ?? edgeWalk(nodes, edges, hubId, "story-pro-style");
  const char =
    byId(stored?.characterColumnId) ??
    (style
      ? edgeWalk(nodes, edges, style.id, "story-pro-character")
      : edgeWalk(nodes, edges, hubId, "story-pro-character"));
  const scene =
    byId(stored?.sceneColumnId) ??
    (char ? edgeWalk(nodes, edges, char.id, "story-pro-scene") : undefined);
  const frame =
    byId(stored?.frameColumnId) ??
    (scene
      ? edgeWalk(nodes, edges, scene.id, "story-pro-frame")
      : char
        ? edgeWalk(nodes, edges, char.id, "story-pro-frame")
        : undefined);
  const video =
    byId(stored?.videoColumnId) ??
    (frame ? edgeWalk(nodes, edges, frame.id, "story-pro-video") : undefined);
  const jy =
    byId(stored?.jianyingExportId) ??
    (video ? edgeWalk(nodes, edges, video.id, "jianying-export-pro") : undefined);

  return [hub, style, char, scene, frame, video, jy].filter(
    (n): n is CanvasFlowNode => Boolean(n),
  );
}

function buildComicChain(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  stored?: StoryWorkspaceIds | null,
): CanvasFlowNode[] {
  const hub = nodes.find((n) => n.id === hubId);
  if (!hub || hub.type !== "story-script-hub") return [];

  const byId = (id?: string) =>
    id ? nodes.find((n) => n.id === id) : undefined;

  const char =
    byId(stored?.characterColumnId) ??
    edgeWalk(nodes, edges, hubId, "story-character-column");
  const frame =
    byId(stored?.frameColumnId) ??
    (char ? edgeWalk(nodes, edges, char.id, "story-frame-column") : undefined);
  const video =
    byId(stored?.videoColumnId) ??
    (frame ? edgeWalk(nodes, edges, frame.id, "story-video-column") : undefined);
  const jy =
    byId(stored?.jianyingExportId) ??
    (video ? edgeWalk(nodes, edges, video.id, "jianying-export") : undefined);

  return [hub, char, frame, video, jy].filter((n): n is CanvasFlowNode =>
    Boolean(n),
  );
}

function storedWorkspaceForHub(
  nodes: CanvasFlowNode[],
  hubId: string,
): StoryWorkspaceIds | StoryProWorkspaceIds | null {
  for (const n of nodes) {
    if (n.type !== "story-comic-starter" && n.type !== "story-pro-starter") {
      continue;
    }
    const ws = (
      n.data as { workspaceIds?: StoryWorkspaceIds | StoryProWorkspaceIds }
    ).workspaceIds;
    if (ws?.scriptHubId === hubId) return ws;
  }
  return null;
}

function pipelineChainForHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
): CanvasFlowNode[] {
  const hub = nodes.find((n) => n.id === hubId);
  if (!hub) return [];
  const stored = storedWorkspaceForHub(nodes, hubId);
  if (hub.type === "story-pro-script-hub") {
    const starter = nodes.find((n) => {
      if (n.type !== "story-pro-starter") return false;
      return (
        (n.data as { workspaceIds?: StoryProWorkspaceIds }).workspaceIds
          ?.scriptHubId === hubId
      );
    });
    const ws =
      (starter &&
        findStoryProWorkspaceForStarter(
          nodes,
          edges,
          starter.id,
          stored as StoryProWorkspaceIds | null,
        )) ??
      (stored as StoryProWorkspaceIds | null);
    return buildProChain(nodes, edges, hubId, ws ?? undefined);
  }
  return buildComicChain(
    nodes,
    edges,
    hubId,
    (stored as StoryWorkspaceIds | null) ??
      findWorkspaceForScriptHub(nodes, edges, hubId) ??
      undefined,
  );
}

function hubIdForNode(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): string | null {
  if (node.type === "story-script-hub" || node.type === "story-pro-script-hub") {
    return node.id;
  }
  const hubNodeId = (node.data as { hubNodeId?: string }).hubNodeId;
  if (hubNodeId) return hubNodeId;
  for (const n of nodes) {
    if (n.type !== "story-comic-starter" && n.type !== "story-pro-starter") {
      continue;
    }
    const ws = (
      n.data as { workspaceIds?: StoryWorkspaceIds | StoryProWorkspaceIds }
    ).workspaceIds;
    if (!ws?.scriptHubId) continue;
    const ids = Object.values(ws).filter(
      (v): v is string => typeof v === "string",
    );
    if (ids.includes(node.id)) return ws.scriptHubId;
  }
  return null;
}

export type StoryPipelineDeleteValidation =
  | { ok: true; allowedIds: string[] }
  | { ok: false; message: string; blockedIds: string[] };

/** Story 工作流：仅允许删除链上尾部后缀（可多个），中间节点不可删。 */
export function validateStoryPipelineDeletion(
  candidateIds: string[],
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): StoryPipelineDeleteValidation {
  const unique = [...new Set(candidateIds.filter(Boolean))];
  if (!unique.length) return { ok: true, allowedIds: [] };

  const allowed = new Set<string>();
  const blocked = new Set<string>();
  const storyByHub = new Map<string, string[]>();

  for (const id of unique) {
    const node = nodes.find((n) => n.id === id);
    if (!node || !isStoryPipelineType(node.type)) {
      allowed.add(id);
      continue;
    }
    const hubId = hubIdForNode(node, nodes);
    if (!hubId) {
      allowed.add(id);
      continue;
    }
    const list = storyByHub.get(hubId) ?? [];
    list.push(id);
    storyByHub.set(hubId, list);
  }

  for (const [hubId, ids] of storyByHub) {
    const chain = pipelineChainForHub(nodes, edges, hubId);
    const chainIds = chain.map((n) => n.id);
    const indices = ids
      .map((id) => chainIds.indexOf(id))
      .filter((i) => i >= 0);
    if (!indices.length) {
      ids.forEach((id) => allowed.add(id));
      continue;
    }
    const minIdx = Math.min(...indices);
    const expectedSuffix = chainIds.slice(minIdx);
    const sortedSelected = [...ids].sort(
      (a, b) => chainIds.indexOf(a) - chainIds.indexOf(b),
    );
    const matchesTail =
      sortedSelected.length === expectedSuffix.length &&
      sortedSelected.every((id, i) => id === expectedSuffix[i]);

    if (matchesTail) {
      ids.forEach((id) => allowed.add(id));
    } else {
      ids.forEach((id) => blocked.add(id));
    }
  }

  if (blocked.size) {
    return {
      ok: false,
      blockedIds: [...blocked],
      message:
        "Story 工作流仅支持从末端删除：可一次删除末尾多个节点，或从后往前逐个删除；中间节点不可单独删除。",
    };
  }

  return { ok: true, allowedIds: [...allowed] };
}
