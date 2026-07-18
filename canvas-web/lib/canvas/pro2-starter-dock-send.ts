import { pickRuntimeImagePreviewUrl, pickRuntimeVideoUrl, isLikelyVideoUrl } from "./task-media-url";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

function upstreamHttpsImageUrl(node: CanvasFlowNode): string | null {
  if (
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view" ||
    node.type === "sbv1-image"
  ) {
    const url = String(
      (node.data as { ossUrl?: string; blobUrl?: string }).ossUrl ??
        (node.data as { blobUrl?: string }).blobUrl ??
        "",
    ).trim();
    return /^https?:\/\//i.test(url) ? url : null;
  }
  if (node.type === "sbv1-video-engine" || node.type === "video-engine") {
    const d = node.data as {
      runtime?: { ossUrl?: string; previewUrl?: string };
      ossUrl?: string;
      blobUrl?: string;
      videoUrl?: string;
      modelKey?: string;
    };
    const url = String(
      pickRuntimeVideoUrl(d.runtime) ??
        pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ??
        d.runtime?.ossUrl ??
        d.ossUrl ??
        d.blobUrl ??
        d.videoUrl ??
        "",
    ).trim();
    return /^https?:\/\//i.test(url) ? url : null;
  }
  return null;
}

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
    if (upstreamHttpsImageUrl(src)) return true;
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
  const preset = String(input.pro2PresetKind ?? "").trim();
  if (
    preset === "image-to-prompt" ||
    preset === "video-to-prompt" ||
    !preset
  ) {
    return pro2StarterHasUpstreamLlmImage(
      input.nodeId,
      input.nodes,
      input.edges,
    );
  }
  return false;
}
