"use client";

import { Clapperboard, Film } from "lucide-react";

/** 漫剧剧场过渡：胶片 + 场记板（暖色 cinematic） */
export function StoryOpenLoader() {
  return (
    <div className="relative mx-auto flex flex-col items-center gap-7 py-2">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(20rem,80vw)] w-[min(20rem,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.14] blur-[52px] motion-reduce:hidden"
        aria-hidden
      />

      <div className="relative flex h-[5.5rem] w-[11rem] items-center justify-center" aria-hidden>
        <Clapperboard
          strokeWidth={1.35}
          className="absolute -left-1 top-0 z-10 h-14 w-14 text-amber-500 motion-safe:animate-story-clap motion-reduce:opacity-95 drop-shadow-md"
        />
        <Film
          strokeWidth={1.25}
          className="absolute right-0 top-3 h-12 w-12 text-amber-600/70 motion-safe:animate-story-reel motion-reduce:opacity-90"
        />
        <div className="absolute inset-x-2 bottom-0 h-9 overflow-hidden rounded-lg border border-amber-200/80 bg-[#f6f8fa] shadow-sm">
          <div className="flex h-full motion-safe:animate-story-film-track motion-reduce:opacity-80">
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className="mx-1 inline-block h-full w-6 shrink-0 rounded-sm border border-amber-400/20 bg-gradient-to-b from-amber-200/15 to-amber-900/30"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-1 w-[min(14rem,72vw)] overflow-hidden rounded-full bg-amber-950/30">
        <div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-amber-400/90 to-transparent motion-safe:animate-story-spotlight motion-reduce:opacity-70"
          aria-hidden
        />
      </div>
    </div>
  );
}
