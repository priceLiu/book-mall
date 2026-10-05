"use client";

import { Film } from "lucide-react";

import { cn } from "./cn";

/** 迷你剪辑台 · 时间线加载（呼吸光晕，非旋转圈） */
export function ComposeMiniLoadingBreath({
  label = "正在加载时间线…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className,
      )}
      aria-hidden
    >
      <div className="relative flex size-[4.5rem] items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-sky-400/15 animate-ping"
          style={{ animationDuration: "2.4s" }}
        />
        <span
          className="absolute inset-2 rounded-full bg-sky-400/20 animate-pulse"
          style={{ animationDuration: "2s" }}
        />
        <span
          className="absolute inset-4 rounded-full border border-sky-300/25 bg-sky-500/10 animate-pulse"
          style={{ animationDuration: "2.8s" }}
        />
        <Film className="relative size-7 text-sky-200/90" strokeWidth={1.5} />
      </div>
      <p className="animate-pulse text-xs text-white/55">{label}</p>
    </div>
  );
}
