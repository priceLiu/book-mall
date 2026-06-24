"use client";

import { Sparkles } from "lucide-react";

/** AI 画布过渡：节点网格 + 连线脉冲（紫青 creative） */
export function CanvasOpenLoader() {
  return (
    <div className="relative mx-auto flex flex-col items-center gap-7 py-2">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(22rem,85vw)] w-[min(22rem,85vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.12] blur-[48px] motion-reduce:hidden"
        aria-hidden
      />

      <div
        className="relative h-[8.5rem] w-[10.5rem] rounded-2xl border border-violet-200 bg-[#f6f8fa] shadow-sm"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.06)_1px,transparent_1px)] bg-[size:18px_18px] motion-safe:animate-canvas-grid-pulse motion-reduce:opacity-80" />

        <svg
          viewBox="0 0 168 136"
          className="absolute inset-0 h-full w-full text-violet-400/70"
          fill="none"
        >
          <path
            d="M36 88 L84 52 L132 88"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="motion-safe:animate-canvas-edge-draw motion-reduce:opacity-80"
            strokeDasharray="120"
            strokeDashoffset="120"
          />
        </svg>

        <span className="absolute left-[18%] top-[58%] size-7 rounded-lg border border-cyan-400/40 bg-cyan-500/20 motion-safe:animate-canvas-node-a motion-reduce:translate-y-0 shadow-[0_0_12px_rgba(34,211,238,0.25)]" />
        <span className="absolute left-[42%] top-[32%] size-7 rounded-lg border border-violet-400/50 bg-violet-500/25 motion-safe:animate-canvas-node-b motion-reduce:translate-y-0 shadow-[0_0_12px_rgba(167,139,250,0.3)]" />
        <span className="absolute right-[16%] top-[58%] size-7 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/20 motion-safe:animate-canvas-node-c motion-reduce:translate-y-0 shadow-[0_0_12px_rgba(232,121,249,0.25)]" />

        <Sparkles
          strokeWidth={1.5}
          className="absolute right-3 top-3 size-5 text-cyan-300/80 motion-safe:animate-canvas-sparkle motion-reduce:opacity-90"
        />
      </div>
    </div>
  );
}
