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
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import {
  canvasDockBarLeftPx,
  clampCanvasDockBarPosition,
  useCanvasDockBarPosition,
} from "@/lib/canvas/use-canvas-dock-bar-offset";
import { LIBTV_CANVAS_DOCK_BAR_CLASS } from "@/lib/canvas/libtv-node-chrome";
import { cn } from "@/lib/utils";

export type LibtvCanvasDockBarSlotProps = {
  /** localStorage 键，建议 edition 级如 `pro2:dock-bar-v1` */
  storageKey: string;
  /** 旧版 per-project 键，用于迁移 */
  legacyStorageKeys?: readonly string[];
  children: ReactElement;
  dockRef?: MutableRefObject<HTMLDivElement | null>;
  className?: string;
};

const DOCK_GRIP_DRAG_THRESHOLD_PX = 6;

const DOCK_SHELL_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 36,
  mass: 0.88,
};

const DOCK_TOOLS_COLLAPSE_MS = 320;

/** 画布底部 Dock 槽：左侧把手拖动 reposition；轻点收起/展开（持久化） */
export function LibtvCanvasDockBarSlot({
  storageKey,
  legacyStorageKeys = [],
  children,
  dockRef,
  className,
}: LibtvCanvasDockBarSlotProps) {
  const { position, setPositionLocal, commitPosition } = useCanvasDockBarPosition(
    storageKey,
    { legacyKeys: legacyStorageKeys },
  );
  const innerRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dockWidth, setDockWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0,
  );

  const assignDockRef = useCallback(
    (el: HTMLDivElement | null) => {
      innerRef.current = el;
      if (dockRef) dockRef.current = el;
    },
    [dockRef],
  );

  const collapsed = position.collapsed;

  const clampToViewport = useCallback((next: typeof position) => {
    const el = innerRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    return clampCanvasDockBarPosition(w, h, next);
  }, []);

  useEffect(() => {
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPositionLocal((prev) =>
        prev.collapsed ? prev : clampToViewport(prev),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setPositionLocal, clampToViewport]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDockWidth(el.offsetWidth);
      setPositionLocal((prev) => {
        if (prev.collapsed) return prev;
        const next = clampToViewport(prev);
        if (next.offsetX === prev.offsetX && next.offsetY === prev.offsetY) {
          return prev;
        }
        return next;
      });
    });
    ro.observe(el);
    setDockWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, [setPositionLocal, clampToViewport]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (positionRef.current.collapsed) return;
      const deltaX = e.clientX - drag.startX;
      const deltaY = drag.startY - e.clientY;
      setPositionLocal((prev) =>
        clampToViewport({
          ...prev,
          offsetX: drag.startOffsetX + deltaX,
          offsetY: drag.startOffsetY + deltaY,
        }),
      );
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const moved = Math.hypot(deltaX, deltaY);
      dragRef.current = null;
      setDragging(false);
      if (moved < DOCK_GRIP_DRAG_THRESHOLD_PX) {
        commitPosition((prev) => {
          const nextCollapsed = !prev.collapsed;
          if (nextCollapsed) {
            return { ...prev, collapsed: true };
          }
          return clampToViewport({ ...prev, collapsed: false });
        });
      } else if (!positionRef.current.collapsed) {
        commitPosition(clampToViewport(positionRef.current));
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, setPositionLocal, commitPosition, clampToViewport]);

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
    embedInShell: false,
  } as { embedInShell: boolean });

  const targetLeft = canvasDockBarLeftPx({
    collapsed,
    offsetX: position.offsetX,
    dockWidth,
    viewportWidth,
  });

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-4 z-[70]",
        className,
      )}
    >
      <motion.div
        ref={assignDockRef}
        className={cn(
          LIBTV_CANVAS_DOCK_BAR_CLASS,
          "pointer-events-auto absolute items-center gap-0 pl-1.5",
          collapsed ? "pr-1.5" : "pr-2.5",
          dragging && "ring-1 ring-white/10",
        )}
        initial={false}
        animate={{
          left: targetLeft,
          bottom: position.offsetY,
        }}
        transition={
          dragging
            ? { duration: 0 }
            : collapsed
              ? {
                  left: {
                    ...DOCK_SHELL_SPRING,
                    delay: (DOCK_TOOLS_COLLAPSE_MS * 0.4) / 1000,
                  },
                  bottom: DOCK_SHELL_SPRING,
                }
              : DOCK_SHELL_SPRING
        }
      >
        <button
          type="button"
          data-dock-drag-handle=""
          aria-label={
            collapsed ? "展开底部工具栏（可拖动）" : "收起底部工具栏（可拖动）"
          }
          aria-expanded={!collapsed}
          title={collapsed ? "点击展开" : "点击收起 · 按住拖动"}
          className={cn(
            "nodrag flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-white/35 transition-colors hover:bg-white/10 hover:text-white/65 active:cursor-grabbing",
            dragging && "cursor-grabbing bg-white/10 text-white/70",
            collapsed && "text-white/55",
          )}
          onPointerDown={onGripPointerDown}
        >
          <GripVertical className="pointer-events-none size-5" strokeWidth={1.75} />
        </button>
        <div
          className={cn(
            "flex min-w-0 items-center overflow-hidden",
            "transition-[max-width,opacity,margin] ease-out",
            collapsed && "pointer-events-none",
          )}
          style={{
            maxWidth: collapsed ? 0 : 1600,
            opacity: collapsed ? 0 : 1,
            marginLeft: collapsed ? 0 : undefined,
            transitionDuration: `${DOCK_TOOLS_COLLAPSE_MS}ms`,
          }}
          aria-hidden={collapsed}
        >
          <span
            className="mx-0.5 h-9 w-px shrink-0 bg-white/10"
            aria-hidden
          />
          {child}
        </div>
      </motion.div>
    </div>
  );
}
