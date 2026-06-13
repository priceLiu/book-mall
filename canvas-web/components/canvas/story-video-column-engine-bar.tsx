"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { STORY_VIDEO_ENGINE_BAR_H } from "@/lib/canvas/story-column-layout";

/** 分镜视频列 · VIDEO / TTS 模型横排 */
export function StoryVideoColumnEngineBar({
  videoPicker,
  ttsPicker,
  actions,
  className,
}: {
  videoPicker: ReactNode;
  ttsPicker: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full shrink-0 items-stretch gap-2", className)}>
      <div
        className={cn(
          RF_NODE_DRAG_HANDLE,
          "grid min-w-0 flex-1 cursor-grab grid-cols-2 gap-3 active:cursor-grabbing",
        )}
        title="拖动模型条移动节点"
        style={{ height: STORY_VIDEO_ENGINE_BAR_H }}
      >
        <div className="min-h-0 overflow-hidden">{videoPicker}</div>
        <div className="min-h-0 overflow-hidden">{ttsPicker}</div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center self-center">{actions}</div>
      ) : null}
    </div>
  );
}
