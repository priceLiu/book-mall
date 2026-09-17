"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { libtvMediaLooksGenerating } from "@/lib/canvas/canvas-task-generating-state";
import {
  LIBTV_MEDIA_GENERATING_CYAN_CLASS,
  LIBTV_MEDIA_GENERATING_VIOLET_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import { CANVAS_SEMANTIC_STATUS_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import {
  storyEditionSpinClass,
  type StoryEdition,
} from "@/lib/canvas/story-edition-chrome";
import type { CanvasCancelGenerationJob } from "@/lib/canvas/canvas-run-bus";
import { cn } from "@/lib/utils";
import { DotGridGeneratingBackground } from "./dot-grid-generating-background";

/** LibTV 媒体节点是否处于生图/生视频/上传进行中 */
export function isLibtvMediaGenerating(data: {
  uploading?: unknown;
  blobUrl?: string;
  runtime?: {
    status?: string;
    taskId?: string;
    ossUrl?: string;
    ephemeralUrl?: string;
  } | null;
}): boolean {
  return libtvMediaLooksGenerating(data);
}

export type LibtvMediaGeneratingCancelScope = Omit<
  CanvasCancelGenerationJob,
  "nodeId"
>;

/** 分镜列 edition → 点阵 / 扫光主题色（comic / pro → cyan，pro2 → violet） */
export function libtvGeneratingVariantForEdition(
  edition: StoryEdition,
): "cyan" | "violet" {
  return edition === "pro2" ? "violet" : "cyan";
}

/** LibTV 媒体 stage · 生成中（点阵底 + 外框扫光 + 中央 RefreshCw），见 design.md §15 */
export function LibtvMediaGeneratingState({
  label,
  variant = "cyan",
  tone = "active",
  className,
  children,
  cancelNodeId: _cancelNodeId,
  cancelScope: _cancelScope,
  onCancel: _onCancel,
  passNodeDrag = false,
  dotGrid = true,
}: {
  /** 留空则仅显示扫光 + 旋转图标，不渲染文字（避免「排队中…」等影响心情的提示） */
  label?: string;
  /** sbv1 / 分镜1.0 → cyan；Pro2 → violet */
  variant?: "cyan" | "violet";
  /** 超过 10min 后台轮询 */
  tone?: "active" | "background";
  className?: string;
  /** 稀疏点阵缓亮底（默认开启；向导卡片等可传 false 关闭） */
  dotGrid?: boolean;
  /** 可选：上传中半透明底图等 */
  children?: ReactNode;
  /** @deprecated 中止改由 Dock 生成钮（黑色停止方块）；保留 props 兼容旧调用 */
  cancelNodeId?: string;
  cancelScope?: LibtvMediaGeneratingCancelScope;
  onCancel?: () => void;
  /** 画布节点：遮罩不挡整卡拖动 */
  passNodeDrag?: boolean;
}) {
  const shimmerClass =
    variant === "violet"
      ? LIBTV_MEDIA_GENERATING_VIOLET_CLASS
      : LIBTV_MEDIA_GENERATING_CYAN_CLASS;
  const edition = variant === "violet" ? "pro2" : "pro";
  const spinClass = storyEditionSpinClass(edition, "xl");
  const spinRingClass =
    variant === "violet"
      ? "border-violet-400/45 bg-black/55 text-violet-200"
      : "border-cyan-400/45 bg-black/55 text-cyan-200";
  const labelClass = `text-[11px] font-medium ${CANVAS_SEMANTIC_STATUS_CLASS}`;

  return (
    <div className={cn("absolute inset-0", className)}>
      {/*
        扫光类 `.canvas-story-media-generating` 自带 `position: relative`，
        不可与 `absolute inset-0` 同元素混用，否则 stage 内高度塌陷、扫光不可见。
      */}
      <div
        className={cn(
          "relative min-h-0 min-w-0 size-full overflow-hidden",
          shimmerClass,
        )}
      >
        {dotGrid ? (
          <DotGridGeneratingBackground variant={variant} className="z-0" />
        ) : null}
        {children}
        <div
          className={cn(
            "absolute inset-0 z-10",
            dotGrid ? "bg-black/28" : "bg-black/45",
            passNodeDrag && "pointer-events-none",
          )}
        >
          <div className="flex size-full items-center justify-center">
            <span
              className={cn(
                "flex size-[4.5rem] items-center justify-center rounded-full border shadow-lg backdrop-blur-sm",
                spinRingClass,
              )}
            >
              <RefreshCw className={spinClass} />
            </span>
            {label?.trim() ? (
              <span className={cn("absolute bottom-3 left-0 right-0 px-4", labelClass)}>
                {label}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
