import type { CanvasProjectSummary } from "@/lib/canvas-api";

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
  if (!p.coverMediaKind) {
    return { url: p.thumbnailUrl };
  }
  return {
    url: p.thumbnailUrl,
    coverMediaKind: p.coverMediaKind,
    coverVideoUrl: p.coverVideoUrl,
    coverPosterUrl: p.coverPosterUrl,
    showMediaKindBadge: true,
  };
}
