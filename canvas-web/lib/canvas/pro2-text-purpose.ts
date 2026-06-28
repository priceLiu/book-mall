import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 文本节点用途：仅 story-outline 走故事大纲 LLM / STORY_PRO2_THEME_OUTLINE_SYSTEM */
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

function edgeLinksScriptHub(
  nodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
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
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
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

/** 解析文本节点是否应走故事大纲链路（显式字段优先，其次连线/预设推断） */
export function resolvePro2TextPurpose(
  data: Pro2TextPurposeNodeData,
  ctx?: {
    nodeId?: string;
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
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
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
  },
): boolean {
  return resolvePro2TextPurpose(data, ctx) === "story-outline";
}

/** 加载画布：为缺少 pro2TextPurpose 的文本节点补全用途（不覆盖用户显式设置） */
export function migratePro2TextPurposeAll(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (n.type !== "story-pro2-starter") return n;
    const data = (n.data ?? {}) as Pro2TextPurposeNodeData & {
      themeOutlineRuntime?: { status?: string };
      generatedOutlineMd?: string;
    };
    const ctx = { nodeId: n.id, nodes, edges };

    if (data.pro2TextPurpose === "story-outline") {
      const linkedHub =
        ctx.nodeId &&
        edges.some((e) => {
          if (e.source !== ctx.nodeId && e.target !== ctx.nodeId) return false;
          const otherId = e.source === ctx.nodeId ? e.target : e.source;
          const other = nodes.find((node) => node.id === otherId);
          return other?.type === "story-pro2-script-hub";
        });
      const hasOutlineWork =
        Boolean(data.generatedOutlineMd?.trim()) ||
        data.themeOutlineRuntime?.status === "pending" ||
        data.themeOutlineRuntime?.status === "running";
      if (!linkedHub && !hasOutlineWork) {
        return {
          ...n,
          data: { ...n.data, pro2TextPurpose: "general" as const },
        };
      }
      return n;
    }

    if (
      data.pro2TextPurpose === "general"
    ) {
      return n;
    }
    const inferred = resolvePro2TextPurpose(data, ctx);
    if (inferred === "story-outline") return n;
    return {
      ...n,
      data: { ...n.data, pro2TextPurpose: inferred },
    };
  });
}
