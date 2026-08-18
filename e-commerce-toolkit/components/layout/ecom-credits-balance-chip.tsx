"use client";

import { useEcomCreditBalance } from "@/lib/use-ecom-credit-balance";

function formatBalance(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

/** 侧栏个人区 · 剩余积分 */
export function EcomCreditsBalanceChip({ collapsed }: { collapsed?: boolean }) {
  const { total } = useEcomCreditBalance();

  if (total == null) return null;

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-0.5 py-1 text-[10px] leading-tight text-[var(--ecom-chrome-text-muted)]"
        title={`剩余积分 ${formatBalance(total)}`}
        aria-live="polite"
      >
        <span className="tabular-nums font-medium text-[var(--ecom-chrome-text)]">
          {formatBalance(total)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg border border-[var(--ecom-chrome-border)] bg-[var(--ecom-chrome-surface)] px-3 py-2 text-[12px] leading-snug text-[var(--ecom-chrome-text-muted)]"
      aria-live="polite"
      title="剩余积分"
    >
      <span className="text-[var(--ecom-chrome-text-subtle)]">剩余积分</span>
      <span className="tabular-nums font-medium text-[var(--ecom-chrome-text)]">
        {formatBalance(total)}
      </span>
    </div>
  );
}
