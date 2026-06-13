"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CanvasPaneContextMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
  children?: CanvasPaneContextMenuItem[];
};

function isLeafItem(
  item: CanvasPaneContextMenuItem,
): item is CanvasPaneContextMenuItem & { onClick: () => void } {
  return !item.children?.length && typeof item.onClick === "function";
}

function CanvasPaneContextMenuRow({
  item,
  depth,
  onClose,
  onActivateLeaf,
}: {
  item: CanvasPaneContextMenuItem;
  depth: number;
  onClose: () => void;
  onActivateLeaf: (item: CanvasPaneContextMenuItem) => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const [subOpen, setSubOpen] = useState(false);
  const hasChildren = Boolean(item.children?.length);
  const Icon = item.icon;

  const openSub = () => {
    if (item.disabled || !hasChildren) return;
    setSubOpen(true);
  };

  const closeSub = () => setSubOpen(false);

  return (
    <div
      className="relative"
      onMouseEnter={openSub}
      onMouseLeave={closeSub}
    >
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        aria-haspopup={hasChildren ? "menu" : undefined}
        aria-expanded={hasChildren ? subOpen : undefined}
        disabled={item.disabled}
        className={cn(
          "nodrag flex w-full min-w-[168px] items-center gap-2 px-3 py-[5px] text-left text-[13px] leading-[18px]",
          "font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]",
          item.disabled
            ? "cursor-default text-white/35"
            : "cursor-default text-white/92 hover:bg-[#0a84ff] hover:text-white",
        )}
        onMouseDown={(e) => {
          if (item.disabled || e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          if (hasChildren) {
            setSubOpen(true);
            return;
          }
          if (isLeafItem(item)) {
            onActivateLeaf(item);
            onClose();
          }
        }}
      >
        {Icon ? (
          <Icon className="size-4 shrink-0 opacity-90" />
        ) : depth > 0 ? (
          <span className="size-4 shrink-0" aria-hidden />
        ) : null}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {hasChildren ? (
          <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
        ) : null}
      </button>
      {hasChildren && subOpen ? (
        <div
          className="absolute left-full top-0 z-10 min-w-[168px] py-1"
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-[6px] border border-white/10 bg-[#323232]/96 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            {item.children!.map((child) => (
              <CanvasPaneContextMenuRow
                key={child.id}
                item={child}
                depth={depth + 1}
                onClose={onClose}
                onActivateLeaf={onActivateLeaf}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CanvasPaneContextMenu({
  open,
  position,
  items,
  onClose,
}: {
  open: boolean;
  position: { x: number; y: number };
  items: CanvasPaneContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target;
      if (target instanceof Node && ref.current?.contains(target)) {
        return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("contextmenu", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("contextmenu", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined" || !items.length) return null;

  const onActivateLeaf = (item: CanvasPaneContextMenuItem) => {
    if (isLeafItem(item)) item.onClick();
  };

  return createPortal(
    <div
      ref={ref}
      className="nodrag fixed z-[1400] min-w-[168px] overflow-visible py-1"
      style={{ left: position.x, top: position.y }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="overflow-visible rounded-[6px] border border-white/10 bg-[#323232]/96 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {items.map((item) => (
          <CanvasPaneContextMenuRow
            key={item.id}
            item={item}
            depth={0}
            onClose={onClose}
            onActivateLeaf={onActivateLeaf}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
