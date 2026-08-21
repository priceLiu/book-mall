"use client";

import { ProjectCoverMedia } from "@/components/canvas/project-cover-media";
import { TemplateWorkflowDiagramPreview } from "@/components/canvas/template-workflow-diagram-preview";
import { buildTemplateWorkflowDiagramLayout } from "@/lib/canvas/template-workflow-diagram";
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
};

/**
 * 画布列表封面 — 「我的画布」与首页模板共用同一组件。
 * 有 thumbnailUrl → 图片/视频 cover 铺满；无图且有 graph → 工作流结构图；否则占位。
 */
export function CanvasListCover({ url, name, graph, className }: Props) {
  const coverUrl = url?.trim() || "";
  const showDiagram =
    !coverUrl && graph && buildTemplateWorkflowDiagramLayout(graph);

  return (
    <div className={cn(CANVAS_LIST_COVER_CLASS, className)}>
      <div className="absolute inset-0 size-full">
        {coverUrl ? (
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
    </div>
  );
}
