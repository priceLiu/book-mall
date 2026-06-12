"use client";

import { Box } from "lucide-react";
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
  return (
    <button
      type="button"
      disabled={disabled}
      title={label ? `风格：${label}` : "风格库"}
      className={cn(
        "nodrag flex size-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-[9px] transition",
        active
          ? "border-violet-400/45 bg-violet-500/15 text-violet-100"
          : "border-white/12 bg-white/[0.04] text-white/55 hover:border-white/20 hover:bg-white/8 hover:text-white/80",
        disabled && "cursor-not-allowed opacity-40",
      )}
      onClick={onClick}
    >
      <Box className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="max-w-[52px] truncate leading-none">
        {active && label ? label : "风格"}
      </span>
    </button>
  );
}
