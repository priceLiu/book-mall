"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CANVAS_TOOLBAR_BTN_CLASS } from "@/lib/canvas/canvas-chrome-semantics";

export function useCanvasToolbarDropdown(): {
  anchorRef: RefObject<HTMLButtonElement>;
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
  toggle: () => void;
  close: () => void;
} {
  const anchorRef = useRef<HTMLButtonElement>(null!);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    setRect(anchorRef.current?.getBoundingClientRect() ?? null);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, updateRect]);

  return {
    anchorRef,
    open,
    setOpen,
    rect,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  };
}

export function CanvasToolbarDropdownTrigger({
  label,
  open,
  anchorRef,
  onClick,
}: {
  label: string;
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement>;
  onClick: () => void;
}) {
  return (
    <button
      ref={anchorRef}
      type="button"
      onClick={onClick}
      className={cn(
        CANVAS_TOOLBAR_BTN_CLASS,
        open && "border-white/30 bg-white/5",
      )}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {label}
      <ChevronDown
        className={cn("size-3 opacity-60 transition", open && "rotate-180")}
      />
    </button>
  );
}

/** 画布顶栏 · 向下展开的下拉菜单 */
export function CanvasToolbarDropdownMenu({
  open,
  onClose,
  rect,
  children,
  align = "start",
  minWidth = 200,
}: {
  open: boolean;
  onClose: () => void;
  rect: DOMRect | null;
  children: ReactNode;
  align?: "start" | "end";
  minWidth?: number;
}) {
  if (!open || !rect || typeof document === "undefined") return null;

  const left =
    align === "end" ? rect.right - minWidth : rect.left;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[350]"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <div
        role="menu"
        className="overflow-hidden rounded-lg border border-white/10 bg-[#1a1a24] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)]"
        style={{
          position: "fixed",
          left: Math.max(8, left),
          top: rect.bottom + 4,
          zIndex: 351,
          minWidth,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export function CanvasToolbarDropdownItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-white/90 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      <Icon className="size-3.5 shrink-0 text-white/65" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
