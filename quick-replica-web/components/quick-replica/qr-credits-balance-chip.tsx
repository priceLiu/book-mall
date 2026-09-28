"use client";

import { useCallback, useEffect, useState } from "react";

import { QR_CREDITS_BALANCE_REFRESH_EVENT } from "@/lib/qr-credits-settlement-watch";

function formatBalance(n: number): string {
  return n.toLocaleString("zh-CN");
}

function parseCreditTotal(introspect: unknown): number | null {
  if (!introspect || typeof introspect !== "object") return null;
  const raw = introspect as Record<string, unknown>;
  const totalField = raw.credit_balance_total ?? raw.credit_balance;
  if (typeof totalField === "number" && Number.isFinite(totalField)) {
    return Math.max(0, Math.round(totalField));
  }
  return null;
}

/** 顶栏剩余积分。冻结会减少可用余额，结算或释放后刷新。 */
export function QrCreditsBalanceChip() {
  const [total, setTotal] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tools-session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        active?: boolean;
        introspect?: unknown;
        session?: { active?: boolean; introspect?: unknown };
      };
      const active = data.active ?? data.session?.active;
      const introspect = data.introspect ?? data.session?.introspect;
      if (!active) {
        setTotal(null);
        return;
      }
      setTotal(parseCreditTotal(introspect));
    } catch {
      /* 静默 */
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 800);
    const onRefresh = () => void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener(QR_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener(QR_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
    };
  }, [refresh]);

  if (total == null) return null;

  return (
    <span
      className="shrink-0 tabular-nums text-xs text-[var(--qr-text-secondary)]"
      title="剩余积分"
      aria-live="polite"
    >
      剩余 {formatBalance(total)} 积分
    </span>
  );
}
