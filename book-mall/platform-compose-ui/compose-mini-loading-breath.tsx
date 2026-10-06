"use client";

import { Film } from "lucide-react";

import { cn } from "./cn";

const BREATH_KEYFRAMES = `
@keyframes compose-video-lane-breath-x {
  0%, 100% { opacity: 0.22; transform: scaleX(0.9); }
  50% { opacity: 0.62; transform: scaleX(1); }
}
@keyframes compose-video-lane-shimmer {
  0%, 100% { opacity: 0.25; transform: translateX(-8%); }
  50% { opacity: 0.7; transform: translateX(8%); }
}
.compose-video-lane-breath-x {
  animation: compose-video-lane-breath-x 2.8s ease-in-out infinite;
  transform-origin: center center;
}
.compose-video-lane-shimmer {
  animation: compose-video-lane-shimmer 2.8s ease-in-out infinite;
}
`;

/** 迷你剪辑台 · 仅视频轨横向呼吸（不纵向缩放） */
export function ComposeMiniLoadingBreath({
  label = "正在生成时间线…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      aria-hidden
    >
      <style dangerouslySetInnerHTML={{ __html: BREATH_KEYFRAMES }} />

      <div
        className="compose-video-lane-breath-x pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c1624] via-sky-500/25 to-[#0c1624]"
        aria-hidden
      />
      <div
        className="compose-video-lane-shimmer pointer-events-none absolute inset-y-2 inset-x-0 bg-gradient-to-r from-transparent via-sky-300/35 to-transparent"
        aria-hidden
      />

      <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex max-w-[min(92%,20rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 shadow-md ring-1 ring-white/10">
        <Film className="size-4 shrink-0 text-yellow-300" strokeWidth={1.5} />
        <p className="truncate text-[11px] font-medium tabular-nums text-yellow-300">
          {label}
        </p>
      </div>
    </div>
  );
}
