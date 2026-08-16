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
        className="flex flex-col items-center gap-0.5 py-1 text-[10px] leading-tight text-[var(--ecom-chrome-text-muted)]"
        title={`剩余积分 · 文本 ${formatBalance(general)} · 视频 ${formatBalance(video)}`}
        aria-live="polite"
      >
        <span className="tabular-nums font-medium text-[var(--ecom-chrome-text)]">{formatBalance(general)}</span>
        <span className="text-[var(--ecom-chrome-border)]">|</span>
        <span className="tabular-nums font-medium text-[var(--ecom-chrome-text)]">{formatBalance(video)}</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg border border-[var(--ecom-chrome-border)] bg-[var(--ecom-chrome-surface)] px-3 py-2 text-[12px] leading-snug text-[var(--ecom-chrome-text-muted)]"
      aria-live="polite"
      title="剩余积分 · 文本池与视频池"
    >
      <span className="text-[var(--ecom-chrome-text-subtle)]">剩余积分</span>
      <span>
        <span className="text-[var(--ecom-chrome-text-subtle)]">文本</span>
        <span className="ml-1 tabular-nums font-medium text-[var(--ecom-chrome-text)]">
          {formatBalance(general)}
        </span>
      </span>
      <span>
        <span className="text-[var(--ecom-chrome-text-subtle)]">视频</span>
        <span className="ml-1 tabular-nums font-medium text-[var(--ecom-chrome-text)]">
          {formatBalance(video)}
        </span>
      </span>
    </div>
  );
}
