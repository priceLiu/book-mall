"use client";

import { FilmShowcaseCardMedia } from "@/components/home/film-showcase-card-media";
import { ShowcaseMediaKindBadge } from "@/components/home/showcase-media-kind-badge";
import { ProjectCoverMedia } from "@/components/canvas/project-cover-media";
import { TemplateWorkflowDiagramPreview } from "@/components/canvas/template-workflow-diagram-preview";
import { buildTemplateWorkflowDiagramLayout } from "@/lib/canvas/template-workflow-diagram";
import { isProjectThumbnailVideoUrl } from "@/lib/canvas/project-thumbnail";
import type { CanvasGraph } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

/** 列表封面标准尺寸（发现 / 我的画布） */
export const CANVAS_LIST_COVER_WIDTH = 340;
export const CANVAS_LIST_COVER_HEIGHT = 190;

/** 与「我的画布」列表封面完全相同的容器样式（340×190，内容 cover 铺满） */
export const CANVAS_LIST_COVER_CLASS =
  "relative aspect-[340/190] w-full overflow-hidden rounded-xl bg-[var(--canvas-surface-2)]";

/** 首页最近项目 / 发现 / 我的画布 · 宽屏每行 5 个 */
export const CANVAS_LIST_GRID_CLASS =
  "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

type Props = {
  /** 与项目列表 `thumbnailUrl` 同名字段，直接复用 */
  url?: string | null;
  name?: string;
  /** 无 url 时用工作流结构图填满封面（内置模板 / 空模板） */
  graph?: CanvasGraph | null;
  className?: string;
  /** sbv1 · 封面媒体类型（展示角标） */
  coverMediaKind?: "image" | "video";
  /** sbv1 · 悬停播放成片 */
  coverVideoUrl?: string | null;
  /** sbv1 · 成片 poster */
  coverPosterUrl?: string | null;
  /** 左上角展示「成片 / 分镜图」角标 */
  showMediaKindBadge?: boolean;
  /** 弹层 / 嵌套预览内禁用居中放大 */
  disableEnlargePreview?: boolean;
};

/**
 * 画布列表封面 — 「我的画布」与首页模板共用同一组件。
 * sbv1 有成片时：静态封面 + 悬停播放，角标与「视频作品」一致。
 */
export function CanvasListCover({
  url,
  name,
  graph,
  className,
  coverMediaKind,
  coverVideoUrl,
  coverPosterUrl,
  showMediaKindBadge = false,
  disableEnlargePreview = false,
}: Props) {
  const coverUrl = url?.trim() || "";
  const hoverVideo =
    coverVideoUrl?.trim() ||
    (isProjectThumbnailVideoUrl(coverUrl) ? coverUrl : "");
  const mediaKind =
    coverMediaKind ?? (hoverVideo ? "video" : coverUrl ? "image" : undefined);
  const poster = coverPosterUrl?.trim();
  const useHoverVideo = Boolean(hoverVideo && mediaKind === "video");
  const showDiagram =
    !coverUrl && !useHoverVideo && graph && buildTemplateWorkflowDiagramLayout(graph);

  return (
    <div className={cn(CANVAS_LIST_COVER_CLASS, className)}>
      <div className="absolute inset-0 size-full">
        {useHoverVideo ? (
          <FilmShowcaseCardMedia
            url={hoverVideo}
            alt={name ?? "封面"}
            kind="video"
            posterUrl={poster || (coverUrl !== hoverVideo ? coverUrl : undefined)}
            placeholderLetter={name}
            disableEnlargePreview={disableEnlargePreview}
          />
        ) : coverUrl ? (
          <ProjectCoverMedia
            url={coverUrl}
            alt={name ?? "封面"}
            placeholderLetter={name}
          />
        ) : showDiagram ? (
          <TemplateWorkflowDiagramPreview graph={graph!} className="size-full" />
        ) : (
          <ProjectCoverMedia
            url={undefined}
            alt={name ?? "封面"}
            placeholderLetter={name}
          />
        )}
      </div>
      {showMediaKindBadge && mediaKind ? (
        <ShowcaseMediaKindBadge kind={mediaKind} />
      ) : null}
    </div>
  );
}
