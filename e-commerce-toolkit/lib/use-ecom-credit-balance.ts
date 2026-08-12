"use client";

import { useCallback, useEffect, useState } from "react";

import { PLATFORM_CREDITS_BALANCE_REFRESH_EVENT } from "@/lib/ecom-credits-balance-events";
import { fetchEcomToolsSessionFull } from "@/lib/ecom-tools-session-client";

export type EcomCreditPools = {
  general: number | null;
  video: number | null;
};

const POLL_MS = 60_000;
const INITIAL_DELAY_MS = 800;

function parseCreditPools(introspect: unknown): EcomCreditPools {
  if (!introspect || typeof introspect !== "object") {
    return { general: null, video: null };
  }
  const pools = (introspect as Record<string, unknown>).credit_pools;
  if (!pools || typeof pools !== "object") {
    return { general: null, video: null };
  }
  const p = pools as Record<string, unknown>;
  const general =
    typeof p.general === "number" && Number.isFinite(p.general)
      ? Math.max(0, Math.round(p.general))
      : null;
  const video =
    typeof p.video === "number" && Number.isFinite(p.video)
      ? Math.max(0, Math.round(p.video))
      : null;
  return { general, video };
}

/** 电商工具箱侧栏 · 剩余积分（文本池 / 视频池） */
export function useEcomCreditBalance(): EcomCreditPools {
  const [pools, setPools] = useState<EcomCreditPools>({
    general: null,
    video: null,
  });

  const refresh = useCallback(async () => {
    try {
      const raw = await fetchEcomToolsSessionFull();
      if (!raw.active) return;
      setPools(parseCreditPools(raw.introspect));
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
