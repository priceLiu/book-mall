import type { CanvasProjectSummary } from "@/lib/canvas-api";
import { isProjectThumbnailVideoUrl } from "@/lib/canvas/project-thumbnail";

type CoverProps = {
  url?: string | null;
  coverMediaKind?: "image" | "video";
  coverVideoUrl?: string | null;
  coverPosterUrl?: string | null;
  showMediaKindBadge?: boolean;
};

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
