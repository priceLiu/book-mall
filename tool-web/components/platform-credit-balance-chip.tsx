"use client";

import { useCallback, useEffect, useState } from "react";

const REFRESH_EVENT = "platform:credits-balance-refresh";
const POLL_MS = 30_000;

type CreditPools = { general: number | null; video: number | null };

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("zh-CN");
}

/** 工具站顶栏 · 剩余积分（单行） */
export function ToolCreditBalanceChip() {
  const [pools, setPools] = useState<CreditPools>({
    general: null,
    video: null,
  });

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/tool-credits", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const raw = (await r.json().catch(() => null)) as {
        active?: boolean;
        creditPools?: { general?: number; video?: number } | null;
      } | null;
      if (!raw?.active) return;
      const cp = raw.creditPools;
      setPools({
        general:
          cp && typeof cp.general === "number"
            ? Math.max(0, Math.round(cp.general))
            : null,
        video:
          cp && typeof cp.video === "number"
            ? Math.max(0, Math.round(cp.video))
            : null,
      });
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
      className="tool-credit-balance-chip hidden shrink-0 whitespace-nowrap rounded-full border border-[var(--tool-border)] bg-[var(--tool-surface-2)] px-2.5 py-1 text-[11px] leading-none text-[var(--tool-muted)] md:inline-block"
      aria-live="polite"
      title="剩余积分 · 文本池与视频池"
    >
      <span>剩余积分</span>
      <span className="mx-1 opacity-40">·</span>
      <span>文本</span>
      <span className="ml-0.5 tabular-nums font-medium text-[var(--tool-fg)]">
        {fmt(pools.general)}
      </span>
      <span className="mx-1.5 opacity-30">|</span>
      <span>视频</span>
      <span className="ml-0.5 tabular-nums font-medium text-[var(--tool-fg)]">
        {fmt(pools.video)}
      </span>
    </div>
  );
}
