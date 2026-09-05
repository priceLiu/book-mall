"use client";

import type { ReactNode } from "react";
import { RefreshCw, X } from "lucide-react";
import { libtvMediaLooksGenerating } from "@/lib/canvas/canvas-task-generating-state";
import {
  LIBTV_MEDIA_GENERATING_CYAN_CLASS,
  LIBTV_MEDIA_GENERATING_VIOLET_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import { CANVAS_SEMANTIC_STATUS_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import { storyEditionSpinClass } from "@/lib/canvas/story-edition-chrome";
import type { CanvasCancelGenerationJob } from "@/lib/canvas/canvas-run-bus";
import { useCanvasGenerationCancel } from "@/lib/canvas/use-canvas-generation-cancel";
import { cn } from "@/lib/utils";

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

/** LibTV 媒体 stage · 生成中（外框扫光 + 中央 RefreshCw），见 design.md §15 */
export function LibtvMediaGeneratingState({
  label,
  variant = "cyan",
  tone = "active",
  className,
  children,
  cancelNodeId,
  cancelScope,
  onCancel,
  passNodeDrag = false,
}: {
  /** 留空则仅显示扫光 + 旋转图标，不渲染文字（避免「排队中…」等影响心情的提示） */
  label?: string;
  /** sbv1 / 分镜1.0 → cyan；Pro2 → violet */
  variant?: "cyan" | "violet";
  /** 超过 10min 后台轮询 */
  tone?: "active" | "background";
  className?: string;
  /** 可选：上传中半透明底图等 */
  children?: ReactNode;
  /** 传入则显示右上角中止钮（无文案，避免挤偏中央加载态） */
  cancelNodeId?: string;
  cancelScope?: LibtvMediaGeneratingCancelScope;
  onCancel?: () => void;
  /** 画布节点：遮罩不挡整卡拖动，仅中止钮可点 */
  passNodeDrag?: boolean;
}) {
  const { requestCancel } = useCanvasGenerationCancel(
    cancelNodeId ?? "",
    cancelScope,
  );
  const showCancel = Boolean(onCancel || cancelNodeId?.trim());

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

  const handleCancel = () => {
    if (onCancel) {
      void onCancel();
      return;
    }
    if (cancelNodeId?.trim()) {
      void requestCancel();
    }
  };

  return (
    <div className={cn("absolute inset-0", className)}>
      {/*
        扫光类 `.canvas-story-media-generating` 自带 `position: relative`，
        不可与 `absolute inset-0` 同元素混用，否则 stage 内高度塌陷、扫光不可见。
      */}
      <div className={cn("relative size-full overflow-hidden", shimmerClass)}>
        {children}
        <div
          className={cn(
            "absolute inset-0 z-10 bg-black/45",
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
          {showCancel ? (
            <button
              type="button"
              className={cn(
                "nodrag absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border transition",
                passNodeDrag && "pointer-events-auto",
                variant === "violet"
                  ? "border-violet-400/35 bg-violet-950/55 text-violet-100 hover:bg-violet-900/60"
                  : "border-cyan-400/35 bg-cyan-950/55 text-cyan-100 hover:bg-cyan-900/60",
                tone === "background" && "opacity-90",
              )}
              aria-label="中止生成"
              title="中止生成"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
