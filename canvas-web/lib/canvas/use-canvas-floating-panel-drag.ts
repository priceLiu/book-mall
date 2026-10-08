"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

const VIEWPORT_MARGIN = 12;

export type CanvasFloatingPanelSize = { w: number; h: number };

export function assetLibraryFloatingPanelSize(): CanvasFloatingPanelSize {
  if (typeof window === "undefined") {
    return { w: 960, h: 720 };
  }
  const w = Math.min(1152, Math.round(window.innerWidth * 0.92));
  const h = Math.min(860, Math.round(window.innerHeight * 0.9));
  return { w, h };
}

function clampFloatPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - w - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - h - VIEWPORT_MARGIN);
  return {
    x: Math.min(maxX, Math.max(VIEWPORT_MARGIN, x)),
    y: Math.min(maxY, Math.max(VIEWPORT_MARGIN, y)),
  };
}

function centerForSize(w: number, h: number) {
  return clampFloatPos(
    (window.innerWidth - w) / 2,
    (window.innerHeight - h) / 2,
    w,
    h,
  );
}

/** 画布浮层 · 标题栏拖动（资产库、助手等） */
export function useCanvasFloatingPanelDrag(
  open: boolean,
  measureSize: () => CanvasFloatingPanelSize = assetLibraryFloatingPanelSize,
) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resetCenter = useCallback(() => {
    const { w, h } = measureSize();
    setPos(centerForSize(w, h));
  }, [measureSize]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      dragRef.current = null;
      return;
    }
    resetCenter();
  }, [open, resetCenter]);

  useEffect(() => {
    if (!open || pos === null) return;
    const onResize = () => {
      const { w, h } = measureSize();
      setPos((p) => (p ? clampFloatPos(p.x, p.y, w, h) : p));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, pos, measureSize]);

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { w, h } = measureSize();
      setPos(
        clampFloatPos(
          d.originX + (e.clientX - d.startX),
          d.originY + (e.clientY - d.startY),
          w,
          h,
        ),
      );
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [measureSize]);

  const onDragStart = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, textarea, select, [data-no-drag]")) return;
      e.preventDefault();
      const rect = panelRef.current?.getBoundingClientRect();
      const originX = pos?.x ?? rect?.left ?? 0;
      const originY = pos?.y ?? rect?.top ?? 0;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX,
        originY,
      };
    },
    [pos],
  );

  return { pos, panelRef, onDragStart, resetCenter };
}
