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
import { GripHorizontal } from "lucide-react";
import {
  clampCanvasDockBarPosition,
  useCanvasDockBarPosition,
} from "@/lib/canvas/use-canvas-dock-bar-offset";
import { cn } from "@/lib/utils";

export type LibtvCanvasDockBarSlotProps = {
  /** localStorage 键，建议 `pro2:${projectId}` / `sbv1:${projectId}` */
  storageKey: string;
  children: ReactElement;
  dockRef?: MutableRefObject<HTMLDivElement | null>;
  className?: string;
};

/** 画布底部 Dock 槽：仅握把可拖动，位置持久化 */
export function LibtvCanvasDockBarSlot({
  storageKey,
  children,
  dockRef,
  className,
}: LibtvCanvasDockBarSlotProps) {
  const [position, setPosition] = useCanvasDockBarPosition(storageKey);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
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
    (next: { offsetX: number; offsetY: number }) => {
      const el = innerRef.current;
      const w = el?.offsetWidth ?? 0;
      const h = el?.offsetHeight ?? 0;
      return clampCanvasDockBarPosition(w, h, next);
    },
    [],
  );

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => clampToViewport(prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setPosition, clampToViewport]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPosition((prev) => {
        const next = clampToViewport(prev);
        if (next.offsetX === prev.offsetX && next.offsetY === prev.offsetY) {
          return prev;
        }
        return next;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setPosition, clampToViewport]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const deltaX = e.clientX - drag.startX;
      const deltaY = drag.startY - e.clientY;
      setPosition(
        clampToViewport({
          offsetX: drag.startOffsetX + deltaX,
          offsetY: drag.startOffsetY + deltaY,
        }),
      );
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, setPosition, clampToViewport]);

  const onGripPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: position.offsetX,
        startOffsetY: position.offsetY,
      };
      setDragging(true);
      e.preventDefault();
    },
    [position.offsetX, position.offsetY],
  );

  const child = cloneElement(children, {
    ref: assignDockRef,
  } as { ref: typeof assignDockRef });

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-4 z-[70]",
        className,
      )}
    >
      <div
        className="pointer-events-auto absolute flex flex-col items-center"
        style={{
          left: `calc(50% + ${position.offsetX}px)`,
          bottom: `${position.offsetY}px`,
          transform: "translateX(-50%)",
        }}
      >
        <button
          type="button"
          data-dock-drag-handle=""
          aria-label="拖动工具栏位置"
          title="拖动调整位置"
          className={cn(
            "nodrag mb-0.5 flex h-4 w-10 cursor-grab items-center justify-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white/55 active:cursor-grabbing",
            dragging && "cursor-grabbing text-white/55",
          )}
          onPointerDown={onGripPointerDown}
        >
          <GripHorizontal className="size-3 pointer-events-none" />
        </button>
        <div className="pointer-events-auto">{child}</div>
      </div>
    </div>
  );
}
