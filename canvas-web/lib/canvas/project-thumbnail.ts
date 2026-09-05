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

/** 视频节点：优先取成片 URL（非 poster） */
function persistableVideoUrlFromNodeData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const runtime = readRuntime(d);
  const candidates = [
    runtime?.ossUrl,
    typeof d.videoUrl === "string" ? d.videoUrl : "",
    typeof d.ossUrl === "string" ? d.ossUrl : "",
  ]
    .map((raw) => (typeof raw === "string" ? raw : "").trim())
    .filter((url) => url.startsWith("http"));

  return (
    candidates.find((url) => isProjectThumbnailVideoUrl(url)) ?? candidates[0] ?? ""
  );
}

function displayVideoUrlFromNodeData(data: unknown): string {
  const stable = persistableVideoUrlFromNodeData(data);
  if (stable) return stable;

  if (!data || typeof data !== "object") return "";
  const runtime = readRuntime(data as Record<string, unknown>);
  const ephemeral = runtime?.ephemeralUrl?.trim();
  if (ephemeral?.startsWith("http") && isProjectThumbnailVideoUrl(ephemeral)) {
    return ephemeral;
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

/** 列表封面：优先最近一条成片，无成片再回退分镜图 */
export function pickProjectThumbnailUrlPreferVideo(graph: CanvasGraph): string {
  const nodes = [...(graph.nodes ?? [])].reverse();

  return (
    pickFromNodes(nodes, VIDEO_THUMBNAIL_NODE_TYPES, displayVideoUrlFromNodeData) ||
    pickFromNodes(nodes, VIDEO_THUMBNAIL_NODE_TYPES, displayMediaUrlFromNodeData) ||
    pickFromNodes(nodes, IMAGE_THUMBNAIL_NODE_TYPES, displayMediaUrlFromNodeData)
  );
}

export function pickPersistableProjectThumbnailUrlPreferVideo(graph: CanvasGraph): string {
  const nodes = [...(graph.nodes ?? [])].reverse();

  return (
    pickFromNodes(nodes, VIDEO_THUMBNAIL_NODE_TYPES, persistableVideoUrlFromNodeData) ||
    pickFromNodes(nodes, VIDEO_THUMBNAIL_NODE_TYPES, persistableMediaUrlFromNodeData) ||
    pickFromNodes(nodes, IMAGE_THUMBNAIL_NODE_TYPES, persistableMediaUrlFromNodeData)
  );
}

export function isProjectThumbnailVideoUrl(url: string): boolean {
  const u = url.trim();
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(u)) return true;
  if (/\/node-video\//i.test(u)) return true;
  return false;
}

/** 从画布收集全部可用图片 URL（原图 OSS，供门户 Hero 等大图场景） */
export function collectProjectImageUrls(graph: CanvasGraph): string[] {
  const urls = new Set<string>();
  for (const n of graph.nodes ?? []) {
    if (!n.type || !IMAGE_THUMBNAIL_NODE_TYPES.has(n.type)) continue;
    const url = displayMediaUrlFromNodeData(n.data);
    if (url && !isProjectThumbnailVideoUrl(url)) urls.add(url);
  }
  return [...urls];
}
