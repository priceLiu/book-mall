"use client";

import { Clapperboard, Layers } from "lucide-react";

import {
  PRO2_DOCK_ACTIVE_REF_BORDER_CLASS,
  PRO2_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "../sbv1/sbv1-toolbar-anchor-popover";

export type Pro2PackProfileId = "director" | "industrial";

const OPTIONS: Array<{
  id: Pro2PackProfileId;
  label: string;
  hint: string;
}> = [
  { id: "director", label: "简版", hint: "导演表 · 现网制作包" },
  { id: "industrial", label: "专业版", hint: "导演表 + 拉片 analysis" },
];

export function Pro2ScriptPackProfileChip({
  value,
  disabled,
  onChange,
}: {
  value?: Pro2PackProfileId | string;
  disabled?: boolean;
  onChange: (next: Pro2PackProfileId) => void;
}) {
  const { anchorRef, open, setOpen, rect } = useSbv1ToolbarAnchor();
  const { thumbPx, logoIconPx, badgeFontPx } = useLibtvDockRefThumbMetrics();
  const active: Pro2PackProfileId =
    value === "industrial" ? "industrial" : "director";
  const Icon = active === "industrial" ? Clapperboard : Layers;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border bg-white/[0.04] transition-shadow",
          open
            ? PRO2_DOCK_ACTIVE_REF_BORDER_CLASS
            : PRO2_DOCK_REF_IDLE_BORDER_CLASS,
          disabled ? "cursor-not-allowed opacity-40" : "hover:border-white/25",
        )}
        style={{ width: thumbPx, height: thumbPx }}
        title="选择制作档（简版 / 专业版）"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-violet-200/80">
          <Icon style={{ width: logoIconPx, height: logoIconPx }} />
          <span
            className="max-w-full truncate px-0.5 leading-none text-white/50"
            style={{ fontSize: badgeFontPx }}
          >
            {active === "industrial" ? "专业" : "简版"}
          </span>
        </div>
      </button>

      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        align="end"
        placement="above"
        estimatedHeight={140}
        className="min-w-[12rem] overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1f] py-1 shadow-xl"
      >
        <p className="px-2.5 pb-1 pt-0.5 text-[9px] font-medium uppercase tracking-wide text-white/35">
          制作档
        </p>
        {OPTIONS.map((opt) => {
          const selected = opt.id === active;
          return (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "flex w-full flex-col px-2.5 py-1.5 text-left transition",
                selected
                  ? "bg-violet-500/15 text-violet-100"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white/90",
              )}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              <span className="text-[11px]">{opt.label}</span>
              <span className="text-[10px] text-white/40">{opt.hint}</span>
            </button>
          );
        })}
      </Sbv1ToolbarDropdown>
    </>
  );
}
