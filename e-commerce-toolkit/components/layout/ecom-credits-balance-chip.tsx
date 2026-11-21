"use client";

import { useEcomCreditBalance } from "@/lib/use-ecom-credit-balance";

function formatBalance(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

/** 侧栏个人区 · 剩余积分 */
export function EcomCreditsBalanceChip({
  collapsed,
  inline,
}: {
  collapsed?: boolean;
  /** 与「积分充值」同一行时使用（无独立外框） */
  inline?: boolean;
}) {
  const { total } = useEcomCreditBalance();
  const display = formatBalance(total);

  if (total == null && collapsed) return null;

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-0.5 py-1 text-[10px] leading-tight text-[var(--ecom-chrome-text-muted)]"
        title={`剩余积分 ${display}`}
        aria-live="polite"
      >
        <span className="tabular-nums font-medium text-[var(--ecom-chrome-text)]">
          {display}
        </span>
      </div>
    );
  }

  if (inline) {
    return (
      <div
        className="min-w-0 flex-1 leading-snug text-[var(--ecom-chrome-text-muted)]"
        aria-live="polite"
        title="剩余积分"
      >
        <p className="text-[11px] text-[var(--ecom-chrome-text-subtle)]">剩余积分</p>
        <p className="tabular-nums text-lg font-semibold leading-tight text-[var(--ecom-chrome-text)]">
          {display}
        </p>
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
        {display}
      </span>
    </div>
  );
}
