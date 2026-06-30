"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BatchConnectSpawnMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  nodeType?: string;
};

/** 框选批量连线松手菜单 · 锚定在指针位置，轻量无 flyout */
export function BatchConnectSpawnMenu({
  anchor,
  title,
  items,
  onPick,
  onClose,
  onMenuRect,
}: {
  anchor: { x: number; y: number };
  title: string;
  items: BatchConnectSpawnMenuItem[];
  onPick: (itemId: string, nodeType?: string) => void;
  onClose: () => void;
  /** 菜单外框 · 供预览线吸附左侧中点 */
  onMenuRect?: (rect: { x: number; y: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as HTMLElement)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onMenuRect) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      onMenuRect({ x: r.left, y: r.top + r.height / 2 });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMenuRect, title, items]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      className="pro2-add-menu nodrag fixed z-[2120] min-w-[220px] overflow-hidden rounded-xl border border-white/15 bg-[#1c1c1e] py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.75)] ring-1 ring-black/40"
      style={{
        left: anchor.x + 12,
        top: anchor.y,
        transform: "translateY(-50%)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium text-white/40">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-white/88 transition-colors",
              "hover:bg-violet-500/22 hover:text-white",
            )}
            onClick={() => {
              onPick(item.id, item.nodeType);
              onClose();
            }}
          >
            <Icon className="size-4 shrink-0 opacity-80" />
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
