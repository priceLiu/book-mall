import type { CanvasGraph } from "./types";

const IMAGE_THUMBNAIL_NODE_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro2-three-view",
  "image-engine",
  "three-view-engine",
  "image",
]);

const VIDEO_THUMBNAIL_NODE_TYPES = new Set([
  "sbv1-video-engine",
  "video-engine",
  "story-pro2-video",
  "story-pro-video",
]);

function readRuntime(data: Record<string, unknown>) {
  const runtime = data.runtime;
  return runtime && typeof runtime === "object" && !Array.isArray(runtime)
    ? (runtime as { ossUrl?: string; ephemeralUrl?: string; posterUrl?: string })
    : undefined;
}

/** 可持久化封面：仅 OSS / 稳定字段，不含厂商 ephemeral（会过期导致列表坏图） */
function persistableMediaUrlFromNodeData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const runtime = readRuntime(d);

  const poster = runtime?.posterUrl?.trim();
  if (poster?.startsWith("http")) return poster;

  const direct = typeof d.ossUrl === "string" ? d.ossUrl.trim() : "";
  if (direct.startsWith("http")) return direct;

  const fromRuntime = runtime?.ossUrl?.trim();
  if (fromRuntime?.startsWith("http")) return fromRuntime;

  const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
  if (imageUrl.startsWith("http")) return imageUrl;

  const videoUrl = typeof d.videoUrl === "string" ? d.videoUrl.trim() : "";
  if (videoUrl.startsWith("http")) return videoUrl;

  return "";
}

/** 展示兜底：含 ephemeral（仅列表即时展示，不应写入 DB） */
function displayMediaUrlFromNodeData(data: unknown): string {
  const stable = persistableMediaUrlFromNodeData(data);
  if (stable) return stable;

  if (!data || typeof data !== "object") return "";
  const runtime = readRuntime(data as Record<string, unknown>);
  const ephemeral = runtime?.ephemeralUrl?.trim();
  if (ephemeral?.startsWith("http")) return ephemeral;

  return "";
}

function pickFromNodes(
  nodes: Array<{ type?: string; data?: unknown }>,
  nodeTypes: Set<string>,
  pickUrl: (data: unknown) => string,
): string {
  for (const n of nodes) {
    if (!n.type || !nodeTypes.has(n.type)) continue;
    const url = pickUrl(n.data);
    if (url) return url;
  }
  return "";
}

/**
 * 从画布图里挑最近一条图片或视频作为项目缩略图（按节点顺序，后添加优先）。
 * 含 ephemeral 兜底，供列表即时展示。
 */
export function pickProjectThumbnailUrl(graph: CanvasGraph): string {
  const nodes = [...(graph.nodes ?? [])].reverse();

  return (
    pickFromNodes(nodes, IMAGE_THUMBNAIL_NODE_TYPES, displayMediaUrlFromNodeData) ||
    pickFromNodes(nodes, VIDEO_THUMBNAIL_NODE_TYPES, displayMediaUrlFromNodeData)
  );
}

/**
 * 写入 DB 的封面：只用 OSS 等稳定 URL，避免 ephemeral 过期后列表坏图。
 */
export function pickPersistableProjectThumbnailUrl(graph: CanvasGraph): string {
  const nodes = [...(graph.nodes ?? [])].reverse();

  return (
    pickFromNodes(nodes, IMAGE_THUMBNAIL_NODE_TYPES, persistableMediaUrlFromNodeData) ||
    pickFromNodes(nodes, VIDEO_THUMBNAIL_NODE_TYPES, persistableMediaUrlFromNodeData)
  );
}

export function isProjectThumbnailVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url.trim());
}
