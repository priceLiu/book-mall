"use client";

import { useCallback, useEffect, useState } from "react";

const REFRESH_EVENT = "platform:credits-balance-refresh";
const POLL_MS = 30_000;

function parseTotal(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const intro = raw as Record<string, unknown>;
  const totalField = intro.credit_balance_total ?? intro.credit_balance;
  if (typeof totalField === "number" && Number.isFinite(totalField)) {
    return Math.max(0, Math.round(totalField));
  }
  return null;
}

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("zh-CN");
}

/** Story 顶栏 · 剩余积分（单行） */
export function StoryCreditBalanceChip() {
  const [total, setTotal] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/tools-session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const raw = await r.json().catch(() => null);
      if (raw && typeof raw === "object" && (raw as { active?: boolean }).active) {
        setTotal(parseTotal((raw as { introspect?: unknown }).introspect));
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
      className="hidden shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] leading-none text-white/70 lg:inline-block"
      aria-live="polite"
      title="剩余积分"
    >
      <span className="text-white/45">剩余积分</span>
      <span className="mx-1 text-white/25">·</span>
      <span className="tabular-nums font-medium text-white/90">{fmt(total)}</span>
    </div>
  );
}
