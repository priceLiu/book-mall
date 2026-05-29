import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { findProStyleForHub } from "./story-workspace-resolver";

export type StoryProRunStylePayload = {
  styleFinalized?: boolean;
  styleAnchor?: {
    styleAnchorZh?: string;
    styleAnchorEn?: string;
    negativePrompt?: string;
  };
};

function resolveScriptHubIdForProNode(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  node: CanvasFlowNode,
): string | undefined {
  const fromData = (node.data as { hubNodeId?: string }).hubNodeId?.trim();
  if (fromData) return fromData;

  for (const e of edges) {
    if (e.target !== node.id) continue;
    const src = nodes.find((n) => n.id === e.source);
    if (src?.type === "story-pro-script-hub") return src.id;
    if (src?.type === "story-pro-style") {
      const hubId = (src.data as { hubNodeId?: string }).hubNodeId;
      if (hubId) return hubId;
    }
  }

  for (const n of nodes) {
    if (n.type !== "story-pro-starter") continue;
    const ws = (
      n.data as { workspaceIds?: { scriptHubId?: string } & Record<string, string> }
    ).workspaceIds;
    if (!ws?.scriptHubId) continue;
    if (Object.values(ws).includes(node.id)) return ws.scriptHubId;
  }
  return undefined;
}

/** 影视专业版媒体 run 须携带风格定稿与锚定词（book-mall run route 校验） */
export function resolveStoryProRunStylePayload(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  node: CanvasFlowNode,
): StoryProRunStylePayload {
  if (!node.type?.startsWith("story-pro-")) return {};
  if (node.type === "story-pro-style" || node.type === "story-pro-script-hub") {
    return {};
  }

  const hubId = resolveScriptHubIdForProNode(nodes, edges, node);
  if (!hubId) return {};

  const styleNode = findProStyleForHub(nodes, edges, hubId);
  if (!styleNode) return {};

  const d = styleNode.data as {
    styleFinalized?: boolean;
    styleAnchorZh?: string;
    styleAnchorEn?: string;
    negativePrompt?: string;
  };

  return {
    styleFinalized: d.styleFinalized === true,
    styleAnchor: {
      styleAnchorZh: d.styleAnchorZh,
      styleAnchorEn: d.styleAnchorEn,
      negativePrompt: d.negativePrompt,
    },
  };
}
