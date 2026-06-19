"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { GripVertical, X } from "lucide-react";
import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import type { MentionableItem } from "./MentionsTextarea";

const ITEM_W = 200;
const THUMB_H = 240;
/** Dock 内紧凑模式 · 约为默认一半 */
const ITEM_W_DOCK = 100;
const THUMB_H_DOCK = 120;
const GAP = 8;
const PICKER_PAD = 16;
const PICKER_HEADER_H = 36;
const PICKER_MIN_W = 320;
const PICKER_MAX_W = 960;
const PICKER_MIN_W_DOCK = 220;
const PICKER_MAX_W_DOCK = 640;
const MENTION_PICKER_Z = 5000;

function pickerWidthForCount(count: number, compact: boolean): number {
  if (count <= 0) {
    return compact ? PICKER_MIN_W_DOCK : PICKER_MIN_W;
  }
  const itemW = compact ? ITEM_W_DOCK : ITEM_W;
  const minW = compact ? PICKER_MIN_W_DOCK : PICKER_MIN_W;
  const maxW = compact ? PICKER_MAX_W_DOCK : PICKER_MAX_W;
  const content = count * itemW + Math.max(0, count - 1) * 8 + PICKER_PAD;
  return Math.min(maxW, Math.max(minW, content));
}

function pickerHeightForCount(count: number, compact: boolean): number {
  if (count <= 0) return compact ? 120 : 200;
  const thumbH = compact ? THUMB_H_DOCK : THUMB_H;
  return PICKER_HEADER_H + 16 + thumbH + 40 + 8;
}

type AnchorRect = {
  left: number;
  top: number;
  bottom: number;
};

function resolvePickerPosition(
  anchor: AnchorRect,
  pickerW: number,
  pickerH: number,
): { left: number; top: number; flip: boolean } {
  let left = anchor.left;
  left = Math.min(Math.max(12, left), window.innerWidth - pickerW - 12);

  const spaceBelow = window.innerHeight - anchor.bottom - GAP;
  const spaceAbove = anchor.top - GAP;
  const preferBelow =
    spaceBelow >= pickerH || spaceBelow >= spaceAbove;

  if (preferBelow) {
    return { left, top: anchor.bottom + GAP, flip: false };
  }
  return { left, top: anchor.top - GAP, flip: true };
}

/** Dock 内：锚定整坞外壳，弹层在坞外下方/上方，避免挡住参考图行与正文 */
function resolveDockShellPickerPosition(
  dockShell: DOMRect,
  pickerW: number,
  pickerH: number,
): { left: number; top: number; flip: boolean } {
  let left = dockShell.left + (dockShell.width - pickerW) / 2;
  left = Math.min(Math.max(12, left), window.innerWidth - pickerW - 12);

  const belowTop = dockShell.bottom + GAP;
  if (belowTop + pickerH <= window.innerHeight - 12) {
    return { left, top: belowTop, flip: false };
  }

  const aboveTop = dockShell.top - GAP;
  if (aboveTop - pickerH >= 12) {
    return { left, top: aboveTop, flip: true };
  }

  return {
    left,
    top: Math.min(belowTop, window.innerHeight - pickerH - 12),
    flip: false,
  };
}

export function MentionPickerPortal({
  open,
  anchorEl,
  getAnchorRect,
  getDockShellRect,
  items,
  selectedIndex,
  headerTitle = "角色 · 拖标题栏移动 · ←→ Enter 插入",
  emptyHint,
  onSelect,
  onHoverIndex,
  onClose,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  /** 优先：光标 / @ 锚点坐标 */
  getAnchorRect?: () => AnchorRect | null;
  /** LibTV 输入坞外壳 · 有则弹层锚在坞外，避免挡住坞内参考图 */
  getDockShellRect?: () => DOMRect | null;
  items: MentionableItem[];
  selectedIndex: number;
  headerTitle?: string;
  emptyHint: string;
  onSelect: (item: MentionableItem) => void;
  onHoverIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [basePos, setBasePos] = useState({ left: 12, top: 120, flip: true });
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateAnchor = useCallback(() => {
    const dockShell = getDockShellRect?.() ?? null;
    const compact = Boolean(dockShell);
    const w = pickerWidthForCount(items.length, compact);
    const h = pickerHeightForCount(items.length, compact);

    if (dockShell) {
      setBasePos(resolveDockShellPickerPosition(dockShell, w, h));
      return;
    }

    const caret = getAnchorRect?.() ?? null;
    const fallback = anchorEl?.getBoundingClientRect();
    const anchor: AnchorRect | null = caret
      ? caret
      : fallback
        ? {
            left: fallback.left + 12,
            top: fallback.top + 12,
            bottom: fallback.bottom - 12,
          }
        : null;
    if (!anchor) return;

    setBasePos(resolvePickerPosition(anchor, w, h));
  }, [anchorEl, getAnchorRect, getDockShellRect, items.length]);

  useLayoutEffect(() => {
    if (!open) return;
    setDrag({ x: 0, y: 0 });
    updateAnchor();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅打开时复位拖拽偏移
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updateAnchor();
  }, [open, updateAnchor, items.length, selectedIndex]);

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
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = drag.x;
    const oy = drag.y;

    const onMove = (ev: PointerEvent) => {
      setDrag({
        x: ox + (ev.clientX - startX),
        y: oy + (ev.clientY - startY),
      });
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };

  if (!mounted || !open) return null;

  const left = basePos.left + drag.x;
  const top = basePos.top + drag.y;
  const dockShell = getDockShellRect?.() ?? null;
  const compact = Boolean(dockShell);
  const pickerW = pickerWidthForCount(items.length, compact);
  const itemW = compact ? ITEM_W_DOCK : ITEM_W;
  const thumbH = compact ? THUMB_H_DOCK : THUMB_H;

  return createPortal(
    <div
      className={`${RF_NO_DRAG} nopan fixed flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#141414]/98 shadow-2xl backdrop-blur-md`}
      style={{
        left,
        top,
        width: pickerW,
        zIndex: MENTION_PICKER_Z,
        transform: basePos.flip ? "translateY(-100%)" : undefined,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="flex cursor-grab items-center gap-1 border-b border-white/10 bg-white/[0.04] px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
      >
        <GripVertical className="size-3.5 shrink-0 text-white/40" />
        <p className="min-w-0 flex-1 text-[10px] text-[var(--canvas-muted)]">
          {headerTitle}
        </p>
        <button
          type="button"
          className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="overflow-x-auto p-2">
        {items.length ? (
          <div className="flex flex-nowrap gap-2">
            {items.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={`flex shrink-0 flex-col items-stretch gap-2 rounded-lg p-2 text-center transition ${
                  i === selectedIndex
                    ? "bg-[var(--canvas-accent)]/25 text-white ring-1 ring-[var(--canvas-accent)]/40"
                    : "text-white/85 hover:bg-white/8"
                }`}
                style={{ width: itemW }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(m);
                }}
                onMouseEnter={() => onHoverIndex(i)}
              >
                {m.previewUrl ? (
                  <span
                    className="relative w-full overflow-hidden rounded-md border border-white/15 bg-black/40"
                    style={{ height: thumbH }}
                  >
                    <Image
                      src={m.previewUrl}
                      alt=""
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </span>
                ) : (
                  <span
                    className="w-full rounded-md border border-dashed border-white/15 bg-white/5"
                    style={{ height: thumbH }}
                  />
                )}
                <span
                  className={cn(
                    "line-clamp-2 leading-snug",
                    compact ? "text-[10px]" : "text-[11px]",
                  )}
                >
                  @{m.label}
                </span>
              </button>
            ))}
          </div>
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
