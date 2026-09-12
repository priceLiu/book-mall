"use client";

import { Crop } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DisplayRect } from "./rect-frame-handles";

type Props = {
  displayRect: DisplayRect;
  outputWidth: number;
  outputHeight: number;
  className?: string;
};

export function ImageExpandFrameChrome({
  displayRect,
  outputWidth,
  outputHeight,
  className,
}: Props) {
  if (displayRect.w <= 0 || displayRect.h <= 0) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-[25]", className)}>
      <div
        className="absolute flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[11px] text-white/85 backdrop-blur-sm"
        style={{ left: displayRect.x + 8, top: displayRect.y + 8 }}
      >
        <Crop className="size-3 shrink-0 text-white/70" />
        <span>扩图</span>
      </div>
      <div
        className="absolute rounded-md bg-black/55 px-2 py-1 text-[11px] tabular-nums text-white/75 backdrop-blur-sm"
        style={{
          left: displayRect.x + displayRect.w - 8,
          top: displayRect.y + 8,
          transform: "translateX(-100%)",
        }}
      >
        {outputWidth} × {outputHeight}
      </div>
    </div>
  );
}
