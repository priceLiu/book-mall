"use client";

import { useCallback, useEffect, useState } from "react";

const REFRESH_EVENT = "platform:credits-balance-refresh";
const POLL_MS = 30_000;

type CreditPools = { general: number | null; video: number | null };

function parsePools(raw: unknown): CreditPools {
  if (!raw || typeof raw !== "object") return { general: null, video: null };
  const pools = (raw as Record<string, unknown>).credit_pools;
  if (!pools || typeof pools !== "object") return { general: null, video: null };
  const p = pools as Record<string, unknown>;
  return {
    general:
      typeof p.general === "number" && Number.isFinite(p.general)
        ? Math.max(0, Math.round(p.general))
        : null,
    video:
      typeof p.video === "number" && Number.isFinite(p.video)
        ? Math.max(0, Math.round(p.video))
        : null,
  };
}

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("zh-CN");
}

/** Story 顶栏 · 剩余积分（单行） */
export function StoryCreditBalanceChip() {
  const [pools, setPools] = useState<CreditPools>({
    general: null,
    video: null,
  });

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/tools-session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const raw = await r.json().catch(() => null);
      if (raw && typeof raw === "object" && (raw as { active?: boolean }).active) {
        setPools(parsePools((raw as { introspect?: unknown }).introspect));
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

  if (pools.general == null && pools.video == null) return null;

  return (
    <div
      className="hidden shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] leading-none text-white/70 lg:inline-block"
      aria-live="polite"
      title="剩余积分 · 文本池与视频池"
    >
      <span className="text-white/45">剩余积分</span>
      <span className="mx-1 text-white/25">·</span>
      <span className="text-white/50">文本</span>
      <span className="ml-0.5 tabular-nums font-medium text-white/90">
        {fmt(pools.general)}
      </span>
      <span className="mx-1.5 text-white/20">|</span>
      <span className="text-white/50">视频</span>
      <span className="ml-0.5 tabular-nums font-medium text-white/90">
        {fmt(pools.video)}
      </span>
    </div>
  );
}
