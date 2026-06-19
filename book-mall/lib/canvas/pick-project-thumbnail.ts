/**
 * 与 canvas-web/lib/canvas/project-thumbnail.ts 保持逻辑一致（列表/历史读时回填缩略图）。
 */

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

export function pickProjectThumbnailUrl(canvas: unknown): string {
  if (!canvas || typeof canvas !== "object") return "";
  const nodes = (canvas as { nodes?: unknown[] }).nodes;
  if (!Array.isArray(nodes)) return "";

  const reversed = [...nodes].reverse() as Array<{
    type?: string;
    data?: unknown;
  }>;

  return (
    pickFromNodes(reversed, IMAGE_THUMBNAIL_NODE_TYPES, displayMediaUrlFromNodeData) ||
    pickFromNodes(reversed, VIDEO_THUMBNAIL_NODE_TYPES, displayMediaUrlFromNodeData)
  );
}

export function pickPersistableProjectThumbnailUrl(canvas: unknown): string {
  if (!canvas || typeof canvas !== "object") return "";
  const nodes = (canvas as { nodes?: unknown[] }).nodes;
  if (!Array.isArray(nodes)) return "";

  const reversed = [...nodes].reverse() as Array<{
    type?: string;
    data?: unknown;
  }>;

  return (
    pickFromNodes(reversed, IMAGE_THUMBNAIL_NODE_TYPES, persistableMediaUrlFromNodeData) ||
    pickFromNodes(reversed, VIDEO_THUMBNAIL_NODE_TYPES, persistableMediaUrlFromNodeData)
  );
}

export function isProjectThumbnailVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url.trim());
}
