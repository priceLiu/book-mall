"use client";

import { useEffect, useState } from "react";

/**
 * 客户端墙钟（每秒 tick），驱动进行中日志耗时列 live 重算。
 * 首帧返回 null，与 SSR 一致，避免 hydration 秒数不一致（Server 258s / Client 260s）。
 */
export function useLiveWallClockMs(intervalMs = 1_000): number | null {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return nowMs;
}
