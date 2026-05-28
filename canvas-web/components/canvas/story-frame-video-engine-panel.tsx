"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  STORY_ENGINE_STACK_GAP,
  STORY_ENGINE_STACK_H,
  storyEnginePanelH,
} from "@/lib/canvas/story-column-layout";

/**
 * 分镜脚本（3 行）/ 分镜视频（2 行）· 列头网格，每行 STORY_ENGINE_STACK_H。
 */
export function StoryFrameVideoEnginePanel({
  row1,
  row2,
  row3,
  className,
}: {
  row1: ReactNode;
  row2: ReactNode;
  row3?: ReactNode;
  className?: string;
}) {
  const rowCount = row3 != null ? 3 : 2;
  const panelH = storyEnginePanelH(rowCount);

  return (
    <div
      className={cn("nodrag grid w-full shrink-0", className)}
      style={{
        height: panelH,
        gap: STORY_ENGINE_STACK_GAP,
        gridTemplateRows: `repeat(${rowCount}, ${STORY_ENGINE_STACK_H}px)`,
      }}
    >
      <div className="min-h-0 overflow-hidden">{row1}</div>
      <div className="min-h-0 overflow-hidden">{row2}</div>
      {row3 != null ? (
        <div className="min-h-0 overflow-hidden">{row3}</div>
      ) : null}
    </div>
  );
}
