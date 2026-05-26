"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { GripVertical, X } from "lucide-react";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { MentionableItem } from "./MentionsTextarea";

const PICKER_W = 620;
const PICKER_MAX_H = 780;
const THUMB_W = 112;
const THUMB_H = 150;
const GAP = 12;

export function MentionPickerPortal({
  open,
  anchorEl,
  items,
  selectedIndex,
  emptyHint,
  onSelect,
  onHoverIndex,
  onClose,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: MentionableItem[];
  selectedIndex: number;
  emptyHint: string;
  onSelect: (item: MentionableItem) => void;
  onHoverIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [basePos, setBasePos] = useState({ left: 80, top: 120 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateAnchor = useCallback(() => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    setBasePos({
      left: Math.min(
        Math.max(12, r.left),
        window.innerWidth - PICKER_W - 12,
      ),
      top: r.top - GAP,
    });
  }, [anchorEl]);

  useLayoutEffect(() => {
    if (!open) return;
    setDrag({ x: 0, y: 0 });
    updateAnchor();
  }, [open, updateAnchor]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updateAnchor();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updateAnchor]);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      ox: drag.x,
      oy: drag.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setDrag({
      x: d.ox + (e.clientX - d.startX),
      y: d.oy + (e.clientY - d.startY),
    });
  };

  const onHeaderPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  if (!mounted || !open) return null;

  const left = basePos.left + drag.x;
  const top = basePos.top + drag.y;

  return createPortal(
    <div
      className={`${RF_NO_DRAG} ${RF_NO_WHEEL} nopan fixed z-[1200] flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#141414]/98 shadow-2xl backdrop-blur-md`}
      style={{
        left,
        top,
        width: PICKER_W,
        maxHeight: PICKER_MAX_H,
        transform: "translateY(-100%)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="flex cursor-grab items-center gap-1 border-b border-white/10 bg-white/[0.04] px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <GripVertical className="size-3.5 shrink-0 text-white/40" />
        <p className="min-w-0 flex-1 text-[10px] text-[var(--canvas-muted)]">
          角色三视图 · 拖标题栏移动 · ↑↓ Enter 插入
        </p>
        <button
          type="button"
          className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {items.length ? (
          items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`flex w-full items-center gap-4 px-4 py-3 text-left ${
                i === selectedIndex
                  ? "bg-[var(--canvas-accent)]/25 text-white"
                  : "text-white/85 hover:bg-white/8"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(m);
              }}
              onMouseEnter={() => onHoverIndex(i)}
            >
              {m.previewUrl ? (
                <span
                  className="relative shrink-0 overflow-hidden rounded-md border border-white/15"
                  style={{ width: THUMB_W, height: THUMB_H }}
                >
                  <Image
                    src={m.previewUrl}
                    alt=""
                    fill
                    className="object-contain bg-black/40"
                    unoptimized
                  />
                </span>
              ) : (
                <span
                  className="shrink-0 rounded-md border border-dashed border-white/15 bg-white/5"
                  style={{ width: THUMB_W, height: THUMB_H }}
                />
              )}
              <span className="min-w-0 flex-1 text-sm leading-snug">
                @{m.label}
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-[var(--canvas-muted)]">
            {emptyHint}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
