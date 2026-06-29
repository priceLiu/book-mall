import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 文本节点上游图片是否已有可传给 LLM 的 HTTPS OSS URL */
export function pro2StarterHasUpstreamLlmImage(
  nodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): boolean {
  for (const e of edges) {
    if (e.target !== nodeId) continue;
    const src = nodes.find((n) => n.id === e.source);
    if (!src) continue;
    if (
      src.type === "story-pro2-image" ||
      src.type === "story-pro2-three-view" ||
      src.type === "sbv1-image"
    ) {
      const url = String(
        (src.data as { ossUrl?: string }).ossUrl ?? "",
      ).trim();
      if (/^https?:\/\//i.test(url)) return true;
    }
  }
  return false;
}

export function pro2StarterCanSendGeneralText(input: {
  themeInput: string;
  pro2PresetKind?: string;
  nodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
}): boolean {
  if (input.themeInput.trim()) return true;
  if (String(input.pro2PresetKind ?? "").trim() !== "image-to-prompt") {
    return false;
  }
  return pro2StarterHasUpstreamLlmImage(
    input.nodeId,
    input.nodes,
    input.edges,
  );
}
