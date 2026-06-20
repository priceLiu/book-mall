"use client";

import { Sparkles } from "lucide-react";

/** 快速复制过渡页动效 */
export function QuickReplicaOpenLoader() {
  return (
    <div className="relative mx-auto flex flex-col items-center gap-7 py-2">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(20rem,80vw)] w-[min(20rem,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/[0.12] blur-[48px] motion-reduce:hidden"
        aria-hidden
      />
      <div
        className="relative flex h-28 w-44 items-center justify-center rounded-2xl border border-pink-400/25 bg-black/25 shadow-inner backdrop-blur-[1px]"
        aria-hidden
      >
        <Sparkles
          strokeWidth={1.5}
          className="size-10 text-pink-300/90 motion-safe:animate-pulse motion-reduce:opacity-90"
        />
      </div>
    </div>
  );
}
