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
  runtime?: {
    status?: string;
    ossUrl?: string;
    ephemeralUrl?: string;
  } | null;
}): boolean {
  const s = data.runtime?.status;
  const rt = data.runtime;
  // 终态优先：乐观 UI 可能遗留 uploading=true，勿把已完成节点仍显示为生成中
  if (s === "done" || s === "error" || s === "idle") return false;
  if (data.uploading) return true;
  if (s === "running" || s === "pending") return true;
  // 终态已写回成片但 status 未及时刷新（勿在 pending/running 之前短路，否则重生成无扫光）
  if (rt?.ossUrl?.trim() || rt?.ephemeralUrl?.trim()) return false;
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
