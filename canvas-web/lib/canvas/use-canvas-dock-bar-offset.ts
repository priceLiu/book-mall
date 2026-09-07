"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "libtv-canvas-dock-offset:";

export type CanvasDockBarPosition = {
  offsetX: number;
  offsetY: number;
};

const DEFAULT_POSITION: CanvasDockBarPosition = { offsetX: 0, offsetY: 0 };

function parseStoredPosition(raw: string): CanvasDockBarPosition {
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
}

function readStoredPositionFromKey(key: string): CanvasDockBarPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw == null) return null;
    return parseStoredPosition(raw);
  } catch {
    return null;
  }
}

function readStoredPosition(
  storageKey: string,
  legacyKeys: readonly string[] = [],
): CanvasDockBarPosition {
  const primary = readStoredPositionFromKey(storageKey);
  if (primary != null) return primary;
  for (const legacyKey of legacyKeys) {
    const legacy = readStoredPositionFromKey(legacyKey);
    if (legacy != null) {
      writeStoredPosition(storageKey, legacy);
      return legacy;
    }
  }
  return DEFAULT_POSITION;
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

type UseCanvasDockBarPositionOptions = {
  /** 旧版 per-project 键，读到后会迁移到 storageKey */
  legacyKeys?: readonly string[];
};

/** 画布底部 Dock 相对默认位置的偏移；commitPosition 才写入 localStorage */
export function useCanvasDockBarPosition(
  storageKey: string,
  options?: UseCanvasDockBarPositionOptions,
) {
  const legacyKeys = options?.legacyKeys ?? [];
  const legacyKeySig = legacyKeys.join("\0");
  const [position, setPositionState] =
    useState<CanvasDockBarPosition>(DEFAULT_POSITION);
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    setPositionState(readStoredPosition(storageKey, legacyKeys));
    hydratedRef.current = true;
  }, [storageKey, legacyKeySig]);

  const setPositionLocal = useCallback(
    (
      next:
        | CanvasDockBarPosition
        | ((prev: CanvasDockBarPosition) => CanvasDockBarPosition),
    ) => {
      setPositionState((prev) =>
        typeof next === "function" ? next(prev) : next,
      );
    },
    [],
  );

  const commitPosition = useCallback(
    (
      next:
        | CanvasDockBarPosition
        | ((prev: CanvasDockBarPosition) => CanvasDockBarPosition),
    ) => {
      setPositionState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        if (hydratedRef.current) {
          writeStoredPosition(storageKey, value);
        }
        return value;
      });
    },
    [storageKey],
  );

  return { position, setPositionLocal, commitPosition } as const;
}

/** @deprecated 使用 useCanvasDockBarPosition */
export function useCanvasDockBarOffset(storageKey: string) {
  const { position, commitPosition } = useCanvasDockBarPosition(storageKey);
  const setOffsetX = useCallback(
    (next: number | ((prev: number) => number)) => {
      commitPosition((prev) => {
        const offsetX = typeof next === "function" ? next(prev.offsetX) : next;
        return { ...prev, offsetX };
      });
    },
    [commitPosition],
  );
  return [position.offsetX, setOffsetX] as const;
}
