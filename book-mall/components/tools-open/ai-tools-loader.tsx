"use client";

import { Bot, Cog } from "lucide-react";

/** AI 工具站过渡页：咬合齿轮 + 跑道机器人（琥珀 / 青绿 accent） */
export function AiToolsLoader() {
  return (
    <div className="relative mx-auto flex flex-col items-center gap-8 py-2">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(22rem,85vw)] w-[min(22rem,85vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.22)_0%,rgba(34,211,238,0.12)_45%,transparent_72%)] blur-[48px] motion-reduce:hidden"
        aria-hidden
      />

      <div className="relative h-[8.5rem] w-[10rem]" aria-hidden>
        <Cog
          strokeWidth={1.35}
          className="absolute left-0 top-5 h-[4.25rem] w-[4.25rem] text-amber-500 motion-safe:animate-tools-gear-spin-cw motion-reduce:opacity-90"
        />
        <Cog
          strokeWidth={1.35}
          className="absolute right-0 top-0 h-[3.35rem] w-[3.35rem] text-cyan-500 motion-safe:animate-tools-gear-spin-ccw motion-reduce:opacity-90"
        />
        <Cog
          strokeWidth={1.35}
          className="absolute bottom-2 left-1/2 h-[2.85rem] w-[2.85rem] -translate-x-1/2 text-emerald-500 motion-safe:animate-tools-gear-spin-slow motion-reduce:opacity-90"
        />
      </div>

      <div
        className="relative flex h-[4.25rem] w-[min(18rem,88vw)] items-end justify-center overflow-hidden rounded-[999px] border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-cyan-50/60 shadow-[0_8px_32px_-12px_rgba(251,191,36,0.35)]"
      >
        <div
          className="pointer-events-none absolute inset-x-8 bottom-[0.55rem] h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent motion-safe:animate-tools-scan-line motion-reduce:opacity-60"
          aria-hidden
        />
        <Bot
          strokeWidth={1.5}
          className="relative z-10 mb-[0.35rem] h-11 w-11 text-cyan-600 motion-safe:animate-tools-bot-run motion-reduce:translate-x-0"
          aria-hidden
        />
      </div>
    </div>
  );
}
