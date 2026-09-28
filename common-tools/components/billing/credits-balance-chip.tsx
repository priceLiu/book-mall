"use client";

import { useCallback, useEffect, useState } from "react";

import { PLATFORM_CREDITS_BALANCE_REFRESH_EVENT } from "@/lib/credits-balance-events";

function formatBalance(n: number | null): string {
  if (n == null) return "—";
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
export function CommonToolsCreditsBalanceChip() {
  const [total, setTotal] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tools-session", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { active?: boolean; introspect?: unknown };
      if (!data.active) {
        setTotal(null);
        return;
      }
      setTotal(parseCreditTotal(data.introspect));
    } catch {
      /* 静默 */
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 800);
    const onRefresh = () => void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
    window.addEventListener("common-tools:session-refreshed", onRefresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
      window.removeEventListener("common-tools:session-refreshed", onRefresh);
    };
  }, [refresh]);

  if (total == null) return null;

  return (
    <span
      className="tabular-nums text-[#1d1d1f]"
      title="剩余积分"
      aria-live="polite"
    >
      剩余 {formatBalance(total)} 积分
    </span>
  );
}
