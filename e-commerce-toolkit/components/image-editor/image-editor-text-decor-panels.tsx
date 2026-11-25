"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import {
  IMAGE_EDITOR_HIGHLIGHT_DEFAULT_COLOR,
  IMAGE_EDITOR_HIGHLIGHTS,
  imageEditorHighlightStyle,
} from "@/lib/image-editor-text-highlights";
import { IMAGE_EDITOR_WARPS, warpIconD } from "@/lib/image-editor-text-warps";
import { cn } from "@/lib/utils";

import { useFloatDrag } from "./use-float-drag";

function DecorFloat({
  open,
  anchorRef,
  title,
  width,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  title: string;
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useFloatDrag();
  const [pos, setPos] = useState<{ top: number; right: number; height: number } | null>(null);

  useEffect(() => {
    if (!open) drag.reset();
  }, [open, drag.reset]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = Math.min(560, window.innerHeight - 24);
      const top = Math.max(12, Math.min(rect.top - 40, window.innerHeight - height - 12));
      let right = window.innerWidth - rect.left + 10;
      const left = window.innerWidth - right - width;
      if (left < 8) right = Math.max(8, window.innerWidth - 8 - width);
      setPos({ top, right, height });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "color") return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className="fixed z-[80] flex cursor-move flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)] [&_button]:cursor-pointer [&_input]:cursor-auto"
      style={{
        top: pos.top,
        right: pos.right,
        width,
        height: pos.height,
        transform: `translate(${drag.shift.x}px, ${drag.shift.y}px)`,
      }}
      onPointerDown={drag.onPointerDown}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[15px] font-semibold text-[#1d1d1f]">{title}</span>
        <button
          type="button"
          aria-label={`关闭${title}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#8e8e93] hover:bg-[#f3f4f6] hover:text-[#1d1d1f]"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
    </div>,
    document.body,
  );
}

const cardBtn =
  "flex flex-col items-center gap-1 rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-1 py-2 text-[10px] text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40";

export function ImageEditorHighlightControl({
  highlightId,
  color,
  disabled,
  onChange,
}: {
  highlightId?: string;
  color?: string;
  disabled?: boolean;
  onChange: (patch: { highlightId?: string; highlightColor?: string }) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const ink = color || IMAGE_EDITOR_HIGHLIGHT_DEFAULT_COLOR;
  const selected = highlightId && highlightId !== "none" ? highlightId : "none";

  return (
    <>
      <button ref={btnRef} type="button" disabled={disabled} className={cardBtn} onClick={() => setOpen((v) => !v)}>
        <span className="flex h-8 items-center text-[13px] font-semibold tracking-wide">划重</span>
        划重点
      </button>
      <DecorFloat open={open} anchorRef={btnRef} title="划重点" width={280} onClose={() => setOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {IMAGE_EDITOR_HIGHLIGHTS.map((item) => {
            const active = selected === item.id;
            const mark = imageEditorHighlightStyle(item.id, ink);
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.id === "none" ? "无划重点" : item.id}
                className={cn(
                  "flex h-[72px] items-center justify-center rounded-xl bg-[#f6f6f7] text-[15px] font-semibold text-[#1d1d1f]",
                  active && "ring-2 ring-[#3d7eff]",
                )}
                onClick={() => onChange({ highlightId: item.id === "none" ? undefined : item.id, highlightColor: ink })}
              >
                {item.id === "none" ? (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#c7c7cc] text-[#8e8e93]">
                    <span className="block h-px w-4 -rotate-45 bg-[#8e8e93]" />
                  </span>
                ) : (
                  <span style={{ ...mark, fontWeight: 700 }}>ABC</span>
                )}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center justify-between rounded-xl bg-[#f6f6f7] px-3 py-2 text-[13px] text-[#1d1d1f]">
          颜色
          <input
            type="color"
            value={ink}
            aria-label="划重点颜色"
            className="h-7 w-14 cursor-pointer rounded border border-black/10 bg-transparent p-0.5"
            onChange={(e) => onChange({ highlightId: selected === "none" ? "marker" : selected, highlightColor: e.target.value })}
          />
        </label>
      </DecorFloat>
    </>
  );
}

export function ImageEditorWarpControl({
  warpId,
  disabled,
  onChange,
}: {
  warpId?: string;
  disabled?: boolean;
  onChange: (warpId: string | undefined) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = warpId && warpId !== "none" ? warpId : "none";

  return (
    <>
      <button ref={btnRef} type="button" disabled={disabled} className={cardBtn} onClick={() => setOpen((v) => !v)}>
        <span className="flex h-8 items-center text-[13px] font-semibold tracking-wide">变形</span>
        变形
      </button>
      <DecorFloat open={open} anchorRef={btnRef} title="变形" width={300} onClose={() => setOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {IMAGE_EDITOR_WARPS.map((item) => {
            const d = warpIconD(item.id);
            const active = selected === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.id === "none" ? "无变形" : item.id}
                className={cn(
                  "flex h-[72px] items-center justify-center rounded-xl bg-[#f6f6f7]",
                  active && "ring-2 ring-[#3d7eff]",
                )}
                onClick={() => onChange(item.id === "none" ? undefined : item.id)}
              >
                {item.id === "none" || !d ? (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#1d1d1f]">
                    <span className="block h-px w-5 -rotate-45 bg-[#1d1d1f]" />
                  </span>
                ) : (
                  <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
                    <path
                      d={d}
                      fill="none"
                      stroke="#1d1d1f"
                      strokeWidth={1.6}
                      strokeDasharray={item.dotted ? "2.2 2.2" : undefined}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </DecorFloat>
    </>
  );
}
