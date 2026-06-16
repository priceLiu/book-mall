import type { CanvasGraph } from "./types";

function mediaUrlFromNodeData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const direct = typeof d.ossUrl === "string" ? d.ossUrl.trim() : "";
  if (direct.startsWith("http")) return direct;

  const runtime = d.runtime as
    | { ossUrl?: string; ephemeralUrl?: string }
    | undefined;
  const fromRuntime = runtime?.ossUrl?.trim() || runtime?.ephemeralUrl?.trim();
  if (fromRuntime?.startsWith("http")) return fromRuntime;

  const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
  if (imageUrl.startsWith("http")) return imageUrl;

  return "";
}

const THUMBNAIL_MEDIA_NODE_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro2-three-view",
  "image-engine",
  "three-view-engine",
  "image",
  "sbv1-video-engine",
  "video-engine",
  "story-pro2-video",
  "story-pro-video",
]);

/**
 * 从画布图里挑最近一条图片或视频作为项目缩略图（按节点顺序，后添加优先）。
 */
export function pickProjectThumbnailUrl(graph: CanvasGraph): string {
  const nodes = [...(graph.nodes ?? [])].reverse();

  for (const n of nodes) {
    if (!THUMBNAIL_MEDIA_NODE_TYPES.has(n.type)) continue;
    const url = mediaUrlFromNodeData(n.data);
    if (url) return url;
  }

  return "";
}
