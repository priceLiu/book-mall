"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GripHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { AiVideoEngineNodeData } from "@/lib/canvas/types";

/** 视频预览区占分隔容器高度比例（0–1） */
export const REF_VIDEO_PREVIEW_RATIO_DEFAULT = 0.3;
const RATIO_MIN = 0.15;
const RATIO_MAX = 0.68;
const RATIO_EPS = 0.008;
/** 旧版按 px 存高度时，估算容器高度用于迁移 */
const LEGACY_SPLIT_CONTAINER_H = 400;

export const REF_VIDEO_PREVIEW_HEIGHT_DEFAULT = Math.round(
  REF_VIDEO_PREVIEW_RATIO_DEFAULT * LEGACY_SPLIT_CONTAINER_H,
);
export const REF_VIDEO_PREVIEW_HEIGHT_MIN = 100;
export const REF_VIDEO_PROMPT_MIN = 140;

export function clampRefVideoPreviewRatio(r: number): number {
  if (!Number.isFinite(r)) return REF_VIDEO_PREVIEW_RATIO_DEFAULT;
  return Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));
}

/** 读取视频预览比例（兼容旧 videoPreviewHeight） */
export function resolveRefVideoPreviewRatio(
  data: Pick<AiVideoEngineNodeData, "videoPreviewRatio" | "videoPreviewHeight">,
): number {
  if (typeof data.videoPreviewRatio === "number") {
    return clampRefVideoPreviewRatio(data.videoPreviewRatio);
  }
  if (
    typeof data.videoPreviewHeight === "number" &&
    data.videoPreviewHeight > 0
  ) {
    return clampRefVideoPreviewRatio(
      data.videoPreviewHeight / LEGACY_SPLIT_CONTAINER_H,
    );
  }
  return REF_VIDEO_PREVIEW_RATIO_DEFAULT;
}

type CanvasPromptVideoSplitProps = {
  previewRatio: number;
  onPreviewRatioChange: (ratio: number) => void;
  prompt: ReactNode;
  video: ReactNode;
  className?: string;
};

/** 提示词 + 视频预览 · 比例分隔（随节点整体缩放，避免 px 高度回弹） */
export function CanvasPromptVideoSplit({
  previewRatio,
  onPreviewRatioChange,
  prompt,
  video,
  className,
}: CanvasPromptVideoSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startRatio: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** 拖拽中或等待 store 回写前，用本地比例避免被旧 props 覆盖 */
  const [overrideRatio, setOverrideRatio] = useState<number | null>(null);
  const liveRatioRef = useRef(previewRatio);
  const onChangeRef = useRef(onPreviewRatioChange);

  useEffect(() => {
    onChangeRef.current = onPreviewRatioChange;
  }, [onPreviewRatioChange]);

  const displayRatio = overrideRatio ?? previewRatio;

  useEffect(() => {
    liveRatioRef.current = displayRatio;
  }, [displayRatio]);

  useEffect(() => {
    if (overrideRatio == null) return;
    if (Math.abs(previewRatio - overrideRatio) < RATIO_EPS) {
      setOverrideRatio(null);
    }
  }, [previewRatio, overrideRatio]);

  const applyRatio = useCallback((raw: number) => {
    const r = clampRefVideoPreviewRatio(raw);
    liveRatioRef.current = r;
    setOverrideRatio(r);
    return r;
  }, []);

  const finishDrag = useCallback(() => {
    if (!dragRef.current) return;
    const r = liveRatioRef.current;
    dragRef.current = null;
    setDragging(false);
    setOverrideRatio(r);
    onChangeRef.current(r);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.height < 1) return;
      const dy = e.clientY - dragRef.current.startY;
      applyRatio(dragRef.current.startRatio + dy / rect.height);
    };

    const onEnd = () => finishDrag();

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("blur", onEnd);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("blur", onEnd);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [dragging, applyRatio, finishDrag]);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const r = liveRatioRef.current;
    dragRef.current = { startY: e.clientY, startRatio: r };
    setOverrideRatio(r);
    setDragging(true);
  };

  const promptFlex = Math.round((1 - displayRatio) * 1000);
  const videoFlex = Math.round(displayRatio * 1000);

  return (
    <div
      ref={containerRef}
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      <div
        className="flex min-h-0 flex-col overflow-hidden"
        style={{
          flex: `${promptFlex} 1 0`,
          minHeight: REF_VIDEO_PROMPT_MIN,
        }}
      >
        {prompt}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="调整提示词与视频预览高度"
        aria-valuemin={RATIO_MIN}
        aria-valuemax={RATIO_MAX}
        aria-valuenow={Math.round(displayRatio * 100) / 100}
        className={cn(
          RF_NO_DRAG,
          RF_NO_WHEEL,
          "relative z-10 flex shrink-0 cursor-row-resize touch-none select-none items-center justify-center",
          dragging ? "h-4" : "h-3",
        )}
        onPointerDown={onHandlePointerDown}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2",
            dragging ? "bg-[#fb923c]/70" : "bg-white/15",
          )}
        />
        <GripHorizontal
          className={cn(
            "pointer-events-none relative size-4",
            dragging ? "text-[#fb923c]" : "text-white/45",
          )}
          aria-hidden
        />
      </div>

      <div
        className="flex min-h-0 flex-col overflow-hidden"
        style={{
          flex: `${videoFlex} 1 0`,
          minHeight: REF_VIDEO_PREVIEW_HEIGHT_MIN,
        }}
      >
        {video}
      </div>
    </div>
  );
}
