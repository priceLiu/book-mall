"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";

export type Pro2AddNodePopoverProps = {
  open: boolean;
  anchor: { x: number; y: number };
  sections: Pro2AddMenuSection[];
  onClose: () => void;
  onPick: (itemId: string, nodeType?: string) => void;
};

export function Pro2AddNodePopover({
  open,
  anchor,
  sections,
  onClose,
  onPick,
}: Pro2AddNodePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [flyoutId, setFlyoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFlyoutId(null);
      return;
    }
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
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const flyoutSections = sections
    .flatMap((s) => s.items)
    .find((i) => i.id === flyoutId)?.submenu;

  return createPortal(
    <div
      ref={ref}
      className="pro2-add-menu nodrag fixed z-[200] flex items-start gap-0"
      style={{ left: anchor.x, top: anchor.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1e]/98 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {sections.map((section, si) => (
          <div key={section.title ?? si}>
            {section.title ? (
              <p className="px-3 pb-1 pt-2 text-[10px] font-medium text-white/40">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const hasSub = Boolean(item.submenu?.length);
              const active = flyoutId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.enabled}
                  className={cn(
                    "nodrag flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition",
                    item.enabled
                      ? active
                        ? "bg-white/10 text-white"
                        : "text-white/90 hover:bg-white/8"
                      : "cursor-not-allowed text-white/30",
                  )}
                  onMouseEnter={() => {
                    if (hasSub && item.enabled) setFlyoutId(item.id);
                  }}
                  onClick={() => {
                    if (!item.enabled) return;
                    if (hasSub) {
                      setFlyoutId(item.id);
                      return;
                    }
                    onPick(item.id, item.nodeType);
                    onClose();
                  }}
                >
                  <Icon className="size-4 shrink-0 opacity-80" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === "Beta" ? (
                    <span className="rounded px-1 py-0.5 text-[9px] text-white/35">
                      Beta
                    </span>
                  ) : null}
                  {item.badge === "NEW" ? (
                    <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[9px] text-sky-300">
                      NEW
                    </span>
                  ) : null}
                  {hasSub ? (
                    <ChevronRight className="size-3.5 shrink-0 text-white/35" />
                  ) : null}
                </button>
              );
            })}
            {si < sections.length - 1 ? (
              <div className="my-1 border-t border-white/8" />
            ) : null}
          </div>
        ))}
      </div>

      {flyoutSections?.length ? (
        <div className="ml-1 min-w-[168px] overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1e]/98 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {flyoutSections.map((section, si) => (
            <div key={section.title ?? si}>
              {section.title ? (
                <p className="px-3 pb-1 pt-2 text-[10px] font-medium text-white/40">
                  {section.title}
                </p>
              ) : null}
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.enabled}
                    className={cn(
                      "nodrag flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition",
                      item.enabled
                        ? "text-white/90 hover:bg-white/8"
                        : "cursor-not-allowed text-white/30",
                    )}
                    onClick={() => {
                      if (!item.enabled) return;
                      onPick(item.id, item.nodeType);
                      onClose();
                    }}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" />
                    <span className="flex-1">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
