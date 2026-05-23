import type {
  CanvasGraph,
  ImageEngineNodeData,
  ImageNodeData,
} from "./types";

/**
 * 从画布图里挑一张图作为项目缩略图：
 * 优先后置 image-engine 输出，其次 image 节点 OSS。
 */
export function pickProjectThumbnailUrl(graph: CanvasGraph): string {
  const nodes = [...(graph.nodes ?? [])].reverse();

  for (const n of nodes) {
    if (n.type !== "image-engine") continue;
    const url = (n.data as unknown as ImageEngineNodeData).runtime?.ossUrl;
    if (url) return url;
  }

  for (const n of nodes) {
    if (n.type !== "image") continue;
    const url = (n.data as unknown as ImageNodeData).ossUrl;
    if (url) return url;
  }

  return "";
}
