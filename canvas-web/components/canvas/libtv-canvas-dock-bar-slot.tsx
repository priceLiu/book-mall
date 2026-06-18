"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactElement,
} from "react";
import {
  clampCanvasDockBarOffset,
  useCanvasDockBarOffset,
} from "@/lib/canvas/use-canvas-dock-bar-offset";
import { cn } from "@/lib/utils";

export type LibtvCanvasDockBarSlotProps = {
  /** localStorage 键后缀，如 `pro2` / `sbv1` */
  storageKey: string;
  children: ReactElement;
  dockRef?: MutableRefObject<HTMLDivElement | null>;
  className?: string;
};

/** 画布底部 Dock 槽：固定贴底，可左右拖动，偏移持久化 */
export function LibtvCanvasDockBarSlot({
  storageKey,
  children,
  dockRef,
  className,
}: LibtvCanvasDockBarSlotProps) {
  const [offsetX, setOffsetX] = useCanvasDockBarOffset(storageKey);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startOffset: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const assignDockRef = useCallback(
    (el: HTMLDivElement | null) => {
      innerRef.current = el;
      if (dockRef) dockRef.current = el;
    },
    [dockRef],
  );

  const clampToViewport = useCallback(
    (next: number) => {
      const w = innerRef.current?.offsetWidth ?? 0;
      return clampCanvasDockBarOffset(w, next);
    },
    [],
  );

  useEffect(() => {
    const onResize = () => {
      setOffsetX((prev) => clampToViewport(prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setOffsetX, clampToViewport]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setOffsetX((prev) => clampToViewport(prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setOffsetX, clampToViewport]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startOffset: offsetX,
      };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [offsetX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const delta = e.clientX - drag.startX;
      setOffsetX(clampToViewport(drag.startOffset + delta));
    },
    [setOffsetX, clampToViewport],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const child = cloneElement(children, {
    ref: assignDockRef,
  } as { ref: typeof assignDockRef });

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-5 z-[70]",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto absolute bottom-0 select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{
          left: `calc(50% + ${offsetX}px)`,
          transform: "translateX(-50%)",
          touchAction: dragging ? "none" : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {child}
      </div>
    </div>
  );
}
