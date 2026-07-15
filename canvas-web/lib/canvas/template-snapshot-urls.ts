import type { CanvasGraph } from "./types";
import {
  pickPersistableProjectThumbnailUrl,
  pickProjectThumbnailUrl,
} from "./project-thumbnail";

/** 从模板 graph 提取最多 N 张可展示的媒体 URL（用于首页卡片快照拼贴） */
export function collectTemplateSnapshotUrls(
  graph: CanvasGraph | null | undefined,
  limit = 4,
): string[] {
  if (!graph?.nodes?.length) return [];
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (u: string | undefined) => {
    const url = u?.trim();
    if (!url?.startsWith("http") || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  for (const n of [...graph.nodes].reverse()) {
    if (urls.length >= limit) break;
    const d = (n.data ?? {}) as Record<string, unknown>;
    const rt = d.runtime as
      | { ossUrl?: string; posterUrl?: string }
      | undefined;
    push(typeof d.ossUrl === "string" ? d.ossUrl : undefined);
    push(rt?.posterUrl);
    push(rt?.ossUrl);
    push(typeof d.imageUrl === "string" ? d.imageUrl : undefined);
    push(typeof d.videoUrl === "string" ? d.videoUrl : undefined);
  }

  if (!urls.length) {
    const thumb = pickPersistableProjectThumbnailUrl(graph);
    if (thumb) urls.push(thumb);
  }
  return urls.slice(0, limit);
}

/** 模板卡片封面：与「我的画布」列表同一套优先级（DB thumbnail → 图内媒体） */
export function resolveTemplateCoverUrl(
  graph: CanvasGraph | null | undefined,
  thumbnail?: string | null,
): string {
  const thumb = thumbnail?.trim();
  if (thumb?.startsWith("http")) return thumb;
  if (!graph) return "";
  return (
    pickProjectThumbnailUrl(graph) ||
    pickPersistableProjectThumbnailUrl(graph) ||
    collectTemplateSnapshotUrls(graph, 1)[0] ||
    ""
  );
}
