"use client";

import { Box } from "lucide-react";

/** 3D导演台过渡：立体机位 / 场景摆位（紫青 creative） */
export function DirectorOpenLoader() {
  return (
    <div className="relative mx-auto flex flex-col items-center gap-7 py-2">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(22rem,85vw)] w-[min(22rem,85vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.12] blur-[48px] motion-reduce:hidden"
        aria-hidden
      />

      <div
        className="relative flex h-[8.5rem] w-[10.5rem] items-center justify-center rounded-2xl border border-violet-200 bg-[#f6f8fa] shadow-sm"
        aria-hidden
      >
        <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(rgba(139,92,246,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.06)_1px,transparent_1px)] bg-[size:18px_18px] motion-safe:animate-canvas-grid-pulse motion-reduce:opacity-80" />
        <Box
          strokeWidth={1.4}
          className="size-14 text-violet-500/80 motion-safe:animate-canvas-node-b motion-reduce:translate-y-0"
        />
      </div>
    </div>
  );
}
