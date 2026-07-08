/**
 * canvas-web/lib/canvas/pro2-text-purpose.ts 须保持同步（服务端 run 守卫）
 */

export type Pro2TextPurpose = "story-outline" | "general";

export type Pro2TextPurposeNodeData = {
  pro2TextPurpose?: Pro2TextPurpose;
  pro2PresetKind?: string;
};

const GENERAL_PRESETS = new Set<string>([
  "image-to-prompt",
  "video-to-prompt",
  "text-to-video",
]);

type GraphNode = { id: string; type?: string };
type GraphEdge = { source: string; target: string };

function edgeLinksScriptHub(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): boolean {
  for (const e of edges) {
    if (e.source === nodeId && e.target !== nodeId) {
      const tgt = nodes.find((n) => n.id === e.target);
      if (tgt?.type === "story-pro2-script-hub") return true;
    }
    if (e.target === nodeId) {
      const src = nodes.find((n) => n.id === e.source);
      if (src?.type === "story-pro2-script-hub") return true;
    }
  }
  return false;
}

function edgeLinksMediaOnly(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): boolean {
  let hasMedia = false;
  for (const e of edges) {
    if (e.target === nodeId) {
      const src = nodes.find((n) => n.id === e.source);
      if (
        src?.type === "story-pro2-image" ||
        src?.type === "sbv1-image" ||
        src?.type === "story-pro2-three-view" ||
        src?.type === "sbv1-video-engine"
      ) {
        hasMedia = true;
      }
    }
    if (e.source === nodeId) {
      const tgt = nodes.find((n) => n.id === e.target);
      if (
        tgt?.type === "story-pro2-image" ||
        tgt?.type === "sbv1-image" ||
        tgt?.type === "sbv1-video-engine"
      ) {
        hasMedia = true;
      }
    }
  }
  return hasMedia;
}

export function resolvePro2TextPurpose(
  data: Pro2TextPurposeNodeData,
  ctx?: {
    nodeId?: string;
    nodes?: GraphNode[];
    edges?: GraphEdge[];
  },
): Pro2TextPurpose {
  if (data.pro2TextPurpose === "story-outline") return "story-outline";
  if (data.pro2TextPurpose === "general") return "general";

  const preset = String(data.pro2PresetKind ?? "").trim();
  if (preset && GENERAL_PRESETS.has(preset)) return "general";

  const nodeId = ctx?.nodeId?.trim();
  const nodes = ctx?.nodes;
  const edges = ctx?.edges;
  if (nodeId && nodes && edges) {
    if (edgeLinksScriptHub(nodeId, nodes, edges)) return "story-outline";
    if (edgeLinksMediaOnly(nodeId, nodes, edges)) return "general";
  }

  return "general";
}

export function isPro2StoryOutlineTextNode(
  data: Pro2TextPurposeNodeData,
  ctx?: {
    nodeId?: string;
    nodes?: GraphNode[];
    edges?: GraphEdge[];
  },
): boolean {
  return resolvePro2TextPurpose(data, ctx) === "story-outline";
}

export function isPro2GeneralTextNode(
  data: Pro2TextPurposeNodeData,
  ctx?: {
    nodeId?: string;
    nodes?: GraphNode[];
    edges?: GraphEdge[];
  },
): boolean {
  return resolvePro2TextPurpose(data, ctx) === "general";
}
