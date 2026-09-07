import type { CanvasTemplateRecord, CanvasProjectSummary } from "@/lib/canvas-api";
import type { CanvasGraph } from "@/lib/canvas/types";
import {
  isProjectThumbnailVideoUrl,
  pickProjectThumbnailUrl,
  pickProjectThumbnailUrlPreferVideo,
} from "@/lib/canvas/project-thumbnail";

type CoverProps = {
  url?: string | null;
  coverMediaKind?: "image" | "video";
  coverVideoUrl?: string | null;
  coverPosterUrl?: string | null;
  showMediaKindBadge?: boolean;
};

function inferCoverFromThumbnailAndGraph(
  thumbnailUrl: string,
  graph?: unknown,
): CoverProps {
  const thumb = thumbnailUrl.trim();
  let coverVideoUrl = "";
  let coverPosterUrl = "";

  if (
    graph &&
    typeof graph === "object" &&
    Array.isArray((graph as CanvasGraph).nodes)
  ) {
    const g = graph as CanvasGraph;
    const prefer = pickProjectThumbnailUrlPreferVideo(g);
    if (isProjectThumbnailVideoUrl(prefer)) {
      coverVideoUrl = prefer;
      const img = pickProjectThumbnailUrl(g);
      if (img && !isProjectThumbnailVideoUrl(img)) {
        coverPosterUrl = img;
      }
    } else if (prefer && !isProjectThumbnailVideoUrl(prefer)) {
      coverPosterUrl = prefer;
    }
  }

  if (!coverVideoUrl && isProjectThumbnailVideoUrl(thumb)) {
    coverVideoUrl = thumb;
  }

  const coverMediaKind = coverVideoUrl
    ? "video"
    : thumb || coverPosterUrl
      ? "image"
      : undefined;

  if (!coverMediaKind) {
    return { url: thumb || undefined };
  }

  return {
    url: thumb || coverPosterUrl || undefined,
    coverMediaKind,
    coverVideoUrl: coverVideoUrl || undefined,
    coverPosterUrl:
      coverPosterUrl ||
      (thumb && !isProjectThumbnailVideoUrl(thumb) ? thumb : undefined),
    showMediaKindBadge: Boolean(coverVideoUrl),
  };
}

/** 从项目摘要生成 CanvasListCover 的成片悬停 / 角标参数 */
export function canvasListCoverPropsFromProject(
  p: Pick<
    CanvasProjectSummary,
    | "thumbnailUrl"
    | "coverMediaKind"
    | "coverVideoUrl"
    | "coverPosterUrl"
  >,
): CoverProps {
  const coverVideoUrl = p.coverVideoUrl?.trim() || "";
  const thumbnailUrl = p.thumbnailUrl?.trim() || "";
  const inferredVideo =
    coverVideoUrl ||
    (isProjectThumbnailVideoUrl(thumbnailUrl) ? thumbnailUrl : "");
  const coverMediaKind =
    p.coverMediaKind ?? (inferredVideo ? "video" : thumbnailUrl ? "image" : undefined);

  if (!coverMediaKind) {
    return { url: p.thumbnailUrl };
  }
  return {
    url: p.thumbnailUrl,
    coverMediaKind,
    coverVideoUrl: coverVideoUrl || inferredVideo || undefined,
    coverPosterUrl: p.coverPosterUrl,
    showMediaKindBadge: true,
  };
}

/** 从模板 canvas 推断成片封面（发现区模板卡片） */
export function canvasListCoverPropsFromTemplate(
  t: Pick<CanvasTemplateRecord, "thumbnailUrl" | "thumbnail" | "canvas">,
): CoverProps {
  return inferCoverFromThumbnailAndGraph(
    (t.thumbnailUrl ?? t.thumbnail ?? "").trim(),
    t.canvas,
  );
}
