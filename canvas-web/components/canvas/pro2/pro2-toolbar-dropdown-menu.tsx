"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useViewport } from "@xyflow/react";
import { cn } from "@/lib/utils";

export function usePro2ToolbarDropdownAnchor(): {
  anchorRef: RefObject<HTMLButtonElement>;
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
} {
  const anchorRef = useRef<HTMLButtonElement>(null!);
  const [open, setOpen] = useState(false);
  const rect = usePro2ToolbarDropdownRect(open, anchorRef);
  return { anchorRef, open, setOpen, rect };
}

function usePro2ToolbarDropdownRect(
  open: boolean,
  anchorRef: RefObject<HTMLButtonElement>,
): DOMRect | null {
  const viewport = useViewport();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [open, viewport.x, viewport.y, viewport.zoom]);

  return useMemo(() => {
    if (!open) return null;
    return anchorRef.current?.getBoundingClientRect() ?? null;
  }, [open, tick, viewport.x, viewport.y, viewport.zoom, anchorRef]);
}

/** 同一工具条内多个下拉 · 互斥（同时只开一个） */
export function usePro2ToolbarExclusiveDropdowns<K extends string>(
  _keys: readonly K[],
) {
  const anchorsRef = useRef<Partial<Record<K, HTMLButtonElement>>>({});
  const [openKey, setOpenKey] = useState<K | null>(null);
  const viewport = useViewport();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!openKey) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [openKey, viewport.x, viewport.y, viewport.zoom]);

  const rect = useMemo(() => {
    if (!openKey) return null;
    return anchorsRef.current[openKey]?.getBoundingClientRect() ?? null;
  }, [openKey, tick, viewport.x, viewport.y, viewport.zoom]);

  const bindAnchor = (key: K) => (el: HTMLButtonElement | null) => {
    if (el) anchorsRef.current[key] = el;
    else delete anchorsRef.current[key];
  };

  const toggle = (key: K) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const close = () => setOpenKey(null);

  return {
    openKey,
    toggle,
    close,
    rect,
    bindAnchor,
    isOpen: (key: K) => openKey === key,
  };
}

/** 顶栏下拉 · 深色菜单（编辑 / 宫格切分） */
export function Pro2ToolbarDropdownMenu({
  open,
  setOpen,
  rect,
  children,
  className,
  minWidth = 220,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  rect: DOMRect | null;
  children: ReactNode;
  className?: string;
  minWidth?: number;
}) {
  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[200]"
        aria-label="关闭菜单"
        onClick={() => setOpen(false)}
      />
      <div
        className={cn(
          "nodrag overflow-hidden rounded-xl border border-white/10 bg-[#262626] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)]",
          className,
        )}
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top - 6,
          transform: "translateY(-100%)",
          zIndex: 201,
          minWidth,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export function Pro2ToolbarDropdownItem({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="nodrag flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] text-white/90 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0 text-white/70" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
