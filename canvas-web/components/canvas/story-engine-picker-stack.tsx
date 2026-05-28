"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STORY_ENGINE_STACK_H } from "@/lib/canvas/story-column-layout";

/** 引擎区单行槽（与对列 VIDEO / TTS / IMAGE 行高一致） */
export function StoryEnginePickerStack({
  label,
  labelClassName,
  children,
  className,
}: {
  label?: ReactNode;
  labelClassName?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col justify-center overflow-hidden",
        className,
      )}
      style={{ height: STORY_ENGINE_STACK_H }}
    >
      {label ? (
        <p className={cn("shrink-0 leading-tight", labelClassName)}>{label}</p>
      ) : null}
      <div className={cn("min-h-0 shrink-0", label ? "mt-1" : "")}>
        {children}
      </div>
    </div>
  );
}
