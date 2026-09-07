"use client";

import { useCallback, useEffect, useState } from "react";

import { useOptionalCanvasShellSessionContext } from "@/components/auth/canvas-shell-session-provider";
import { PLATFORM_CREDITS_BALANCE_REFRESH_EVENT } from "@/lib/canvas/canvas-credits-balance-events";
import { fetchCanvasToolsSessionFull } from "@/lib/canvas-tools-session-fetch";
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
  const shared = useOptionalCanvasShellSessionContext();
  const [pools, setPools] = useState<CanvasCreditPools>(() => {
    const intro = shared?.payload?.introspect ?? getCachedToolsSession()?.introspect;
    return { total: parseCreditTotal(intro) };
  });

  const refresh = useCallback(async () => {
    const cached = shared?.payload ?? getCachedToolsSession();
    if (cached?.active && cached.introspect) {
      setPools({ total: parseCreditTotal(cached.introspect) });
    }

    try {
      const parsed = await fetchCanvasToolsSessionFull();
      if (parsed.active) {
        setCachedToolsSession(parsed);
        setPools({ total: parseCreditTotal(parsed.introspect) });
      }
    } catch {
      /* 静默 */
    }
  }, [shared?.payload]);

  useEffect(() => {
    if (shared?.payload?.introspect) {
      setPools({ total: parseCreditTotal(shared.payload.introspect) });
    }
  }, [shared?.payload?.introspect]);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    window.addEventListener(PLATFORM_CREDITS_BALANCE_REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("canvas:tools-session-refreshed", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        PLATFORM_CREDITS_BALANCE_REFRESH_EVENT,
        onRefresh,
      );
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("canvas:tools-session-refreshed", onRefresh);
    };
  }, [refresh]);

  return pools;
}
