"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import {
  LIBTV_MEDIA_GENERATING_CYAN_CLASS,
  LIBTV_MEDIA_GENERATING_VIOLET_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import { CANVAS_SEMANTIC_STATUS_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import { storyEditionSpinClass } from "@/lib/canvas/story-edition-chrome";
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
  const s = data.runtime?.status;
  const rt = data.runtime;
  const hasPersistedMedia = Boolean(
    rt?.ossUrl?.trim() || rt?.ephemeralUrl?.trim(),
  );
  // 粘贴/本地上传：blob 预览已就绪且无生成任务 → 不挡图，OSS 在后台上传
  if (data.uploading) {
    const blob = String(data.blobUrl ?? "").trim();
    const hasGenTask = Boolean(rt?.taskId?.trim());
    const genInflight =
      s === "running" || s === "pending" || s === "queued";
    if (blob && !hasGenTask && !genInflight) {
      return false;
    }
    if (s === "done" && hasPersistedMedia) return false;
    return true;
  }
  if (s === "done" || s === "error" || s === "idle") return false;
  if (s === "running" || s === "pending" || s === "queued") return true;
  if (hasPersistedMedia) return false;
  return false;
}

/** LibTV 媒体 stage · 生成中（外框扫光 + 中央 RefreshCw），见 design.md §15 */
export function LibtvMediaGeneratingState({
  label,
  variant = "cyan",
  tone = "active",
  className,
  children,
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
}) {
  const shimmerClass =
    variant === "violet"
      ? LIBTV_MEDIA_GENERATING_VIOLET_CLASS
      : LIBTV_MEDIA_GENERATING_CYAN_CLASS;
  const spinClass = storyEditionSpinClass(
    variant === "violet" ? "pro2" : "pro",
    "lg",
  );
  const labelClass = `text-[11px] font-medium ${CANVAS_SEMANTIC_STATUS_CLASS}`;

  return (
    <div className={cn("absolute inset-0", className)}>
      {/*
        扫光类 `.canvas-story-media-generating` 自带 `position: relative`，
        不可与 `absolute inset-0` 同元素混用，否则 stage 内高度塌陷、扫光不可见。
      */}
      <div className={cn("relative size-full overflow-hidden", shimmerClass)}>
        {children}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/45 px-6 py-10 text-center">
          <RefreshCw className={spinClass} />
          {label?.trim() ? <span className={labelClass}>{label}</span> : null}
        </div>
      </div>
    </div>
  );
}
