"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";

const MENU_SHELL_CLASS =
  "overflow-hidden rounded-xl border border-white/15 bg-[#1c1c1e] py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.75)] ring-1 ring-black/40";

const MENU_ITEM_BASE =
  "nodrag flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors duration-75";

function menuItemClass(enabled: boolean, highlighted: boolean): string {
  if (!enabled) return cn(MENU_ITEM_BASE, "cursor-not-allowed text-white/30");
  if (highlighted) {
    return cn(
      MENU_ITEM_BASE,
      "bg-violet-500/22 text-white ring-1 ring-inset ring-violet-400/35",
    );
  }
  return cn(MENU_ITEM_BASE, "text-white/88");
}

export type Pro2AddNodePopoverPlacement = "top-left" | "above-center" | "beside-pointer";

export type Pro2AddNodePopoverProps = {
  open: boolean;
  anchor: { x: number; y: number } | null;
  sections: Pro2AddMenuSection[];
  onClose: () => void;
  onPick: (itemId: string, nodeType?: string) => void;
  /** above-center：锚点取菜单底边中点，向上展开（Dock 顶栏用）；beside-pointer：松手位置右侧垂直居中 */
  placement?: Pro2AddNodePopoverPlacement;
  /** 菜单主面板左缘中点 · 供拖线预览吸附 */
  onPanelRect?: (pt: { x: number; y: number }) => void;
  menuZIndex?: number;
};

export function Pro2AddNodePopover({
  open,
  anchor,
  sections,
  onClose,
  onPick,
  placement = "top-left",
  onPanelRect,
  menuZIndex = 1400,
}: Pro2AddNodePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const [hoveredMainId, setHoveredMainId] = useState<string | null>(null);
  const [hoveredFlyoutId, setHoveredFlyoutId] = useState<string | null>(null);
  const [maxMainHeight, setMaxMainHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setMaxMainHeight(undefined);
      return;
    }
    const panel = mainPanelRef.current;
    if (!panel) return;
    const margin = 16;
    const available =
      placement === "above-center"
        ? anchor.y - margin
        : window.innerHeight - anchor.y - margin;
    setMaxMainHeight(Math.max(180, Math.min(520, available)));
  }, [open, anchor?.x, anchor?.y, placement, sections]);

  useEffect(() => {
    const panel = mainPanelRef.current;
    if (!open || !panel || !onPanelRect) return;
    const report = () => {
      const r = panel.getBoundingClientRect();
      onPanelRect({ x: r.left, y: r.top + r.height / 2 });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(panel);
    return () => ro.disconnect();
  }, [open, onPanelRect, anchor?.x, anchor?.y, sections, placement]);

  useEffect(() => {
    if (!open) {
      setFlyoutId(null);
      setHoveredMainId(null);
      setHoveredFlyoutId(null);
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

  if (!open || !anchor || typeof document === "undefined") return null;

  const flyoutSections = sections
    .flatMap((s) => s.items)
    .find((i) => i.id === flyoutId)?.submenu;

  return createPortal(
    <div
      ref={ref}
      className="pro2-add-menu nodrag nopan nokey fixed flex items-end gap-0"
      style={{
        left: anchor.x,
        top: anchor.y,
        zIndex: menuZIndex,
        transform:
          placement === "above-center"
            ? "translate(-50%, -100%)"
            : placement === "beside-pointer"
              ? "translateY(-50%)"
              : undefined,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={mainPanelRef}
        className={cn(MENU_SHELL_CLASS, "min-w-[200px]")}
        style={maxMainHeight ? { maxHeight: maxMainHeight, overflowY: "auto" } : undefined}
      >
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
              const highlighted =
                hoveredMainId === item.id || flyoutId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.enabled}
                  className={menuItemClass(item.enabled, highlighted)}
                  onMouseEnter={() => {
                    setHoveredMainId(item.id);
                    setHoveredFlyoutId(null);
                    if (hasSub && item.enabled) setFlyoutId(item.id);
                    else setFlyoutId(null);
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
        <div
          className={cn(MENU_SHELL_CLASS, "-ml-px min-w-[168px] self-stretch")}
          style={maxMainHeight ? { maxHeight: maxMainHeight, overflowY: "auto" } : undefined}
        >
          {flyoutSections.map((section, si) => (
            <div key={section.title ?? si}>
              {section.title ? (
                <p className="px-3 pb-1 pt-2 text-[10px] font-medium text-white/40">
                  {section.title}
                </p>
              ) : null}
              {section.items.map((item) => {
                const Icon = item.icon;
                const highlighted = hoveredFlyoutId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.enabled}
                    className={menuItemClass(item.enabled, highlighted)}
                    onMouseEnter={() => setHoveredFlyoutId(item.id)}
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
