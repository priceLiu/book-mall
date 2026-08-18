"use client";

import { useCallback, useEffect, useState } from "react";

const REFRESH_EVENT = "platform:credits-balance-refresh";
const POLL_MS = 30_000;

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("zh-CN");
}

/** 工具站顶栏 · 剩余积分（单行） */
export function ToolCreditBalanceChip() {
  const [total, setTotal] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/tool-credits", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const raw = (await r.json().catch(() => null)) as {
        active?: boolean;
        creditBalance?: number;
        creditBalanceTotal?: number;
        creditPools?: { general?: number; video?: number } | null;
      } | null;
      if (!raw?.active) return;
      if (typeof raw.creditBalanceTotal === "number") {
        setTotal(Math.max(0, Math.round(raw.creditBalanceTotal)));
        return;
      }
      if (typeof raw.creditBalance === "number") {
        setTotal(Math.max(0, Math.round(raw.creditBalance)));
        return;
      }
      const cp = raw.creditPools;
      if (cp) {
        const g = typeof cp.general === "number" ? cp.general : 0;
        const v = typeof cp.video === "number" ? cp.video : 0;
        setTotal(Math.max(0, Math.round(g + v)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    window.addEventListener(REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refresh]);

  if (total == null) return null;

  return (
    <div
      className="tool-credit-balance-chip hidden shrink-0 whitespace-nowrap rounded-full border border-[var(--tool-border)] bg-[var(--tool-surface-2)] px-2.5 py-1 text-[11px] leading-none text-[var(--tool-muted)] md:inline-block"
      aria-live="polite"
      title="剩余积分"
    >
      <span>剩余积分</span>
      <span className="mx-1 opacity-40">·</span>
      <span className="tabular-nums font-medium text-[var(--tool-fg)]">{fmt(total)}</span>
    </div>
  );
}
