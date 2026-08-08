"use client";

import { Panel } from "@xyflow/react";

import { useCanvasCreditBalance } from "@/lib/canvas/use-canvas-credit-balance";

function formatBalance(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

/** 画布右下角 · 剩余积分（单行） */
export function CanvasCreditsBalancePanel() {
  const { general, video } = useCanvasCreditBalance();

  return (
    <Panel position="bottom-right" className="!m-0 !mb-4 !mr-4">
      <div
        className="pointer-events-none select-none whitespace-nowrap rounded-xl border border-white/10 bg-[#1c1c1e]/98 px-3 py-2 text-[12px] leading-snug text-white/75 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        aria-live="polite"
      >
        <span className="text-white/50">剩余积分</span>
        <span className="mx-1.5 text-white/25" aria-hidden>
          ·
        </span>
        <span className="text-white/55">文本</span>
        <span className="ml-1 tabular-nums font-medium text-white/90">
          {formatBalance(general)}
        </span>
        <span className="mx-2 text-white/20" aria-hidden>
          |
        </span>
        <span className="text-white/55">视频</span>
        <span className="ml-1 tabular-nums font-medium text-white/90">
          {formatBalance(video)}
        </span>
      </div>
    </Panel>
  );
}
