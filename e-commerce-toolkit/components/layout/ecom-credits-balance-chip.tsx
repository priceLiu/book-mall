"use client";

import { useEcomCreditBalance } from "@/lib/use-ecom-credit-balance";

function formatBalance(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

/** 侧栏个人区 · 剩余积分（与画布项目文案一致） */
export function EcomCreditsBalanceChip({ collapsed }: { collapsed?: boolean }) {
  const { general, video } = useEcomCreditBalance();

  if (general == null && video == null) return null;

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-0.5 py-1 text-[10px] leading-tight text-zinc-500"
        title={`剩余积分 · 文本 ${formatBalance(general)} · 视频 ${formatBalance(video)}`}
        aria-live="polite"
      >
        <span className="tabular-nums font-medium text-zinc-300">{formatBalance(general)}</span>
        <span className="text-zinc-600">|</span>
        <span className="tabular-nums font-medium text-zinc-300">{formatBalance(video)}</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[12px] leading-snug text-zinc-400"
      aria-live="polite"
      title="剩余积分 · 文本池与视频池"
    >
      <span className="text-zinc-500">剩余积分</span>
      <span className="mx-1.5 text-zinc-700" aria-hidden>
        ·
      </span>
      <span className="text-zinc-500">文本</span>
      <span className="ml-1 tabular-nums font-medium text-zinc-200">
        {formatBalance(general)}
      </span>
      <span className="mx-2 text-zinc-700" aria-hidden>
        |
      </span>
      <span className="text-zinc-500">视频</span>
      <span className="ml-1 tabular-nums font-medium text-zinc-200">
        {formatBalance(video)}
      </span>
    </div>
  );
}
