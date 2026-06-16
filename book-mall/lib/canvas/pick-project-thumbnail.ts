/**
 * 与 canvas-web/lib/canvas/project-thumbnail.ts 保持逻辑一致（列表/历史读时回填缩略图）。
 * 取画布上最近一条图片或视频节点。
 */

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

export function pickProjectThumbnailUrl(canvas: unknown): string {
  if (!canvas || typeof canvas !== "object") return "";
  const nodes = (canvas as { nodes?: unknown[] }).nodes;
  if (!Array.isArray(nodes)) return "";

  const reversed = [...nodes].reverse() as Array<{
    type?: string;
    data?: unknown;
  }>;

  for (const n of reversed) {
    if (!n.type || !THUMBNAIL_MEDIA_NODE_TYPES.has(n.type)) continue;
    const url = mediaUrlFromNodeData(n.data);
    if (url) return url;
  }

  return "";
}
