"use client";

import { Box } from "lucide-react";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";
import { cn } from "@/lib/utils";

export type Pro2DockStyleButtonProps = {
  active?: boolean;
  label?: string;
  disabled?: boolean;
  onClick: () => void;
};

/** Dock 顶栏 · 风格库入口（图 3 立方体图标） */
export function Pro2DockStyleButton({
  active,
  label,
  disabled,
  onClick,
}: Pro2DockStyleButtonProps) {
  const { actionBtnPx, logoIconPx } = useLibtvDockRefThumbMetrics();

  return (
    <button
      type="button"
      disabled={disabled}
      title={label ? `风格：${label}` : "风格库"}
      style={{
        width: actionBtnPx,
        height: actionBtnPx,
        minWidth: actionBtnPx,
        minHeight: actionBtnPx,
      }}
      className={cn(
        "nodrag flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] transition",
        active
          ? "border-violet-400/45 bg-violet-500/15 text-violet-100"
          : "border-white/12 bg-white/[0.04] text-white/55 hover:border-white/20 hover:bg-white/8 hover:text-white/80",
        disabled && "cursor-not-allowed opacity-40",
      )}
      onClick={onClick}
    >
      <Box
        className="shrink-0"
        style={{ width: logoIconPx, height: logoIconPx }}
        strokeWidth={1.75}
      />
      <span className="max-w-[60px] truncate leading-none">
        {active && label ? label : "风格"}
      </span>
    </button>
  );
}
