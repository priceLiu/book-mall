"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { STORY_FRAME_ENGINE_BAR_H } from "@/lib/canvas/story-column-layout";

/** 分镜脚本列 · 风格勾选 / @ 提示 / IMAGE 模型横排 */
export function StoryFrameScriptEngineBar({
  styleRow,
  hintRow,
  imagePicker,
  actions,
  className,
}: {
  styleRow: ReactNode;
  hintRow: ReactNode;
  imagePicker: ReactNode;
  /** 列顶栏 · 保存为资产等 */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full shrink-0 items-stretch gap-2", className)}>
      <div
        className={cn(
          RF_NODE_DRAG_HANDLE,
          "grid min-w-0 flex-1 cursor-grab grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] gap-3 active:cursor-grabbing",
        )}
        title="拖动模型条移动节点"
        style={{ height: STORY_FRAME_ENGINE_BAR_H }}
      >
        <div className="min-h-0 overflow-hidden">{styleRow}</div>
        <div className="min-h-0 overflow-hidden">{hintRow}</div>
        <div className="min-h-0 overflow-hidden">{imagePicker}</div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center self-center">{actions}</div>
      ) : null}
    </div>
  );
}
