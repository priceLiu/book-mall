"use client";

import { useCallback, useEffect, useState } from "react";

import { PLATFORM_CREDITS_BALANCE_REFRESH_EVENT } from "@/lib/canvas/canvas-credits-balance-events";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";
import {
  getCachedToolsSession,
  setCachedToolsSession,
} from "@/lib/tools-session-client-cache";

export type CanvasCreditPools = {
  general: number | null;
  video: number | null;
};

const POLL_MS = 30_000;

function parseCreditPools(introspect: unknown): CanvasCreditPools {
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

/** 用户剩余积分（文本池 / 视频池 · introspect + 扣费事件即时刷新） */
export function useCanvasCreditBalance(): CanvasCreditPools {
  const [pools, setPools] = useState<CanvasCreditPools>({
    general: null,
    video: null,
  });

  const refresh = useCallback(async () => {
    const cached = getCachedToolsSession();
    if (cached?.active && cached.introspect) {
      setPools(parseCreditPools(cached.introspect));
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
        setPools(parseCreditPools(parsed.introspect));
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
