"use client";

import { useCallback, useEffect, useState } from "react";

import { PLATFORM_CREDITS_BALANCE_REFRESH_EVENT } from "@/lib/canvas/canvas-credits-balance-events";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";
import {
  getCachedToolsSession,
  setCachedToolsSession,
} from "@/lib/tools-session-client-cache";

export type CanvasCreditPools = {
  /** 总可用积分（单池 v2） */
  total: number | null;
};

const POLL_MS = 30_000;

function parseCreditTotal(introspect: unknown): number | null {
  if (!introspect || typeof introspect !== "object") return null;
  const raw = introspect as Record<string, unknown>;
  const totalField = raw.credit_balance_total ?? raw.credit_balance;
  if (typeof totalField === "number" && Number.isFinite(totalField)) {
    return Math.max(0, Math.round(totalField));
  }
  return null;
}

/** 用户剩余积分（introspect + 扣费事件即时刷新） */
export function useCanvasCreditBalance(): CanvasCreditPools {
  const [pools, setPools] = useState<CanvasCreditPools>({ total: null });

  const refresh = useCallback(async () => {
    const cached = getCachedToolsSession();
    if (cached?.active && cached.introspect) {
      setPools({ total: parseCreditTotal(cached.introspect) });
    }

    try {
      const r = await fetch("/api/tools-session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const raw = await r.json().catch(() => null);
      const parsed = parseToolsSessionPayload(raw);
      if (parsed.active) {
        setCachedToolsSession(parsed);
        setPools({ total: parseCreditTotal(parsed.introspect) });
      }
    } catch {
      /* 静默 */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    window.addEventListener(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        PLATFORM_CREDITS_BALANCE_REFRESH_EVENT,
        onRefresh,
      );
      window.removeEventListener("focus", onRefresh);
    };
  }, [refresh]);

  return pools;
}
