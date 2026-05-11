"use client";

import { Bot, Cog } from "lucide-react";

/** AI 工具站过渡页：咬合齿轮 + 跑道机器人（纯 SVG/Lucide + CSS 动画） */
export function AiToolsLoader() {
  return (
    <div className="relative mx-auto flex flex-col items-center gap-8 py-2">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(22rem,85vw)] w-[min(22rem,85vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-[48px] motion-reduce:hidden dark:bg-primary/[0.18]"
        aria-hidden
      />

      <div className="relative h-[8.5rem] w-[10rem]" aria-hidden>
        <Cog
          strokeWidth={1.35}
          className="absolute left-0 top-5 h-[4.25rem] w-[4.25rem] text-primary motion-safe:animate-tools-gear-spin-cw motion-reduce:opacity-90 drop-shadow-md"
        />
        <Cog
          strokeWidth={1.35}
          className="absolute right-0 top-0 h-[3.35rem] w-[3.35rem] text-muted-foreground motion-safe:animate-tools-gear-spin-ccw motion-reduce:opacity-90 drop-shadow"
        />
        <Cog
          strokeWidth={1.35}
          className="absolute bottom-2 left-1/2 h-[2.85rem] w-[2.85rem] -translate-x-1/2 text-primary/85 motion-safe:animate-tools-gear-spin-slow motion-reduce:opacity-90 drop-shadow-sm"
        />
      </div>

      <div className="relative flex h-[4.25rem] w-[min(18rem,88vw)] items-end justify-center overflow-hidden rounded-[999px] border border-border/70 bg-secondary/40 shadow-inner backdrop-blur-[2px] dark:bg-secondary/25">
        <div
          className="pointer-events-none absolute inset-x-8 bottom-[0.55rem] h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent motion-safe:animate-tools-scan-line motion-reduce:opacity-60"
          aria-hidden
        />
        <Bot
          strokeWidth={1.5}
          className="relative z-10 mb-[0.35rem] h-11 w-11 text-primary motion-safe:animate-tools-bot-run motion-reduce:translate-x-0 drop-shadow-md"
          aria-hidden
        />
      </div>
    </div>
  );
}
