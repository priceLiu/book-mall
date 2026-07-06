"use client";

import { cn } from "@/lib/utils";

/** Dock 参考缩略图 · 右上角角标（默认序号；悬停变 × 可删） */
export function DockRefCornerBadge({
  label,
  onRemove,
  title = "断开连线",
  disabled,
  className,
  fontSizePx,
  minSizePx,
}: {
  label: string;
  onRemove: () => void;
  title?: string;
  disabled?: boolean;
  className?: string;
  fontSizePx?: number;
  minSizePx?: number;
}) {
  const glyphPx = fontSizePx ?? 8;

  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        fontSize: fontSizePx,
        minHeight: minSizePx,
        minWidth: minSizePx,
      }}
      className={cn(
        "nodrag absolute right-0.5 top-0.5 z-10 flex items-center justify-center rounded bg-black/70 px-1 py-px font-medium leading-none text-white/90 transition",
        !fontSizePx && "min-h-[14px] min-w-[14px] text-[8px]",
        !fontSizePx &&
          "group-hover:min-h-[14px] group-hover:min-w-[14px] group-hover:rounded group-hover:bg-red-950/90 group-hover:text-white",
        fontSizePx &&
          "group-hover:rounded group-hover:bg-red-950/90 group-hover:text-white",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <span className="group-hover:hidden">{label}</span>
      <span
        className="hidden group-hover:block leading-none"
        style={{ fontSize: glyphPx }}
        aria-hidden
      >
        ×
      </span>
    </button>
  );
}
