"use client";

import { useCallback, useEffect, useState } from "react";

import { PLATFORM_CREDITS_BALANCE_REFRESH_EVENT } from "@/lib/ecom-credits-balance-events";
import { fetchEcomToolsSessionFull } from "@/lib/ecom-tools-session-client";

export type EcomCreditPools = {
  total: number | null;
};

const POLL_MS = 60_000;
const INITIAL_DELAY_MS = 800;

function parseCreditTotal(introspect: unknown): number | null {
  if (!introspect || typeof introspect !== "object") return null;
  const raw = introspect as Record<string, unknown>;
  const totalField = raw.credit_balance_total ?? raw.credit_balance;
  if (typeof totalField === "number" && Number.isFinite(totalField)) {
    return Math.max(0, Math.round(totalField));
  }
  return null;
}

/** 电商工具箱侧栏 · 剩余积分 */
export function useEcomCreditBalance(): EcomCreditPools {
  const [pools, setPools] = useState<EcomCreditPools>({ total: null });

  const refresh = useCallback(async () => {
    try {
      const raw = await fetchEcomToolsSessionFull();
      if (!raw.active) return;
      setPools({ total: parseCreditTotal(raw.introspect) });
    } catch {
      /* 静默 */
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), INITIAL_DELAY_MS);
    const onRefresh = () => void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    window.addEventListener(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
    window.addEventListener("ecom:tools-session-refreshed", onRefresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
      window.removeEventListener("ecom:tools-session-refreshed", onRefresh);
    };
  }, [refresh]);

  return pools;
}
