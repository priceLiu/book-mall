"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "libtv-canvas-dock-offset:";

export function clampCanvasDockBarOffset(
  dockWidth: number,
  offsetX: number,
  padding = 16,
): number {
  if (typeof window === "undefined" || dockWidth <= 0) return offsetX;
  const half = dockWidth / 2;
  const limit = window.innerWidth / 2 - half - padding;
  if (limit <= 0) return 0;
  return Math.min(limit, Math.max(-limit, offsetX));
}

/** 画布底部磁吸 Dock 相对屏幕中心的水平偏移（px），按 edition 持久化 */
export function useCanvasDockBarOffset(storageKey: string) {
  const [offsetX, setOffsetXState] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
      if (raw == null) return;
      const n = Number(raw);
      if (Number.isFinite(n)) setOffsetXState(n);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const setOffsetX = useCallback(
    (next: number | ((prev: number) => number)) => {
      setOffsetXState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, String(value));
        } catch {
          /* ignore */
        }
        return value;
      });
    },
    [storageKey],
  );

  return [offsetX, setOffsetX] as const;
}
