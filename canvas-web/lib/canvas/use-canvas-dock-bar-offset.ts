"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "libtv-canvas-dock-offset:";

export type CanvasDockBarPosition = {
  offsetX: number;
  offsetY: number;
};

const DEFAULT_POSITION: CanvasDockBarPosition = { offsetX: 0, offsetY: 0 };

function readStoredPosition(storageKey: string): CanvasDockBarPosition {
  if (typeof window === "undefined") return DEFAULT_POSITION;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (raw == null) return DEFAULT_POSITION;
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw) as Partial<CanvasDockBarPosition>;
      return {
        offsetX:
          typeof parsed.offsetX === "number" && Number.isFinite(parsed.offsetX)
            ? parsed.offsetX
            : 0,
        offsetY:
          typeof parsed.offsetY === "number" && Number.isFinite(parsed.offsetY)
            ? parsed.offsetY
            : 0,
      };
    }
    const legacyX = Number(raw);
    return {
      offsetX: Number.isFinite(legacyX) ? legacyX : 0,
      offsetY: 0,
    };
  } catch {
    return DEFAULT_POSITION;
  }
}

function writeStoredPosition(storageKey: string, pos: CanvasDockBarPosition) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

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

/** 相对默认贴底位置向上偏移（px）；0 = 默认 bottom-5 */
export function clampCanvasDockBarOffsetY(
  dockHeight: number,
  offsetY: number,
  padding = 16,
): number {
  if (typeof window === "undefined" || dockHeight <= 0) return offsetY;
  const reservedBottom = 20;
  const maxUp =
    window.innerHeight - dockHeight - reservedBottom - padding - 48;
  if (maxUp <= 0) return 0;
  return Math.min(maxUp, Math.max(0, offsetY));
}

export function clampCanvasDockBarPosition(
  dockWidth: number,
  dockHeight: number,
  pos: CanvasDockBarPosition,
): CanvasDockBarPosition {
  return {
    offsetX: clampCanvasDockBarOffset(dockWidth, pos.offsetX),
    offsetY: clampCanvasDockBarOffsetY(dockHeight, pos.offsetY),
  };
}

/** 画布底部 Dock 相对默认位置的偏移，按 storageKey（建议 edition + projectId）持久化 */
export function useCanvasDockBarPosition(storageKey: string) {
  const [position, setPositionState] = useState<CanvasDockBarPosition>(() =>
    readStoredPosition(storageKey),
  );

  useEffect(() => {
    setPositionState(readStoredPosition(storageKey));
  }, [storageKey]);

  const setPosition = useCallback(
    (
      next:
        | CanvasDockBarPosition
        | ((prev: CanvasDockBarPosition) => CanvasDockBarPosition),
    ) => {
      setPositionState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        writeStoredPosition(storageKey, value);
        return value;
      });
    },
    [storageKey],
  );

  return [position, setPosition] as const;
}

/** @deprecated 使用 useCanvasDockBarPosition */
export function useCanvasDockBarOffset(storageKey: string) {
  const [position, setPosition] = useCanvasDockBarPosition(storageKey);
  const setOffsetX = useCallback(
    (next: number | ((prev: number) => number)) => {
      setPosition((prev) => {
        const offsetX = typeof next === "function" ? next(prev.offsetX) : next;
        return { ...prev, offsetX };
      });
    },
    [setPosition],
  );
  return [position.offsetX, setOffsetX] as const;
}
