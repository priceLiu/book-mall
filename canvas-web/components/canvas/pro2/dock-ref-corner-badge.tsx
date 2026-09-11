"use client";

import { cn } from "@/lib/utils";

/** Dock 参考缩略图 · 右上角角标（默认序号；悬停变 × 可删） */
const cornerBadgeClass = (
  fontSizePx: number | undefined,
  minSizePx: number | undefined,
  interactive: boolean,
) =>
  cn(
    "absolute right-0.5 top-0.5 z-10 flex items-center justify-center rounded bg-black/70 px-1 py-px font-medium leading-none text-white/90",
    !fontSizePx && "min-h-[14px] min-w-[14px] text-[8px]",
    interactive &&
      !fontSizePx &&
      "group-hover:min-h-[14px] group-hover:min-w-[14px] group-hover:rounded group-hover:bg-red-950/90 group-hover:text-white",
    interactive &&
      fontSizePx &&
      "group-hover:rounded group-hover:bg-red-950/90 group-hover:text-white",
  );

export function DockRefCornerBadge({
  label,
  onRemove,
  title = "断开连线",
  disabled,
  readOnly,
  className,
  fontSizePx,
  minSizePx,
}: {
  label: string;
  onRemove?: () => void;
  title?: string;
  disabled?: boolean;
  /** 只读角标（不可删 · 尺寸与可删角标一致） */
  readOnly?: boolean;
  className?: string;
  fontSizePx?: number;
  minSizePx?: number;
}) {
  const glyphPx = fontSizePx ?? 8;
  const style = {
    fontSize: fontSizePx,
    minHeight: minSizePx,
    minWidth: minSizePx,
  };

  if (readOnly) {
    return (
      <span
        style={style}
        className={cn(
          cornerBadgeClass(fontSizePx, minSizePx, false),
          "pointer-events-none",
          className,
        )}
        aria-hidden
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      style={style}
      className={cn(
        cornerBadgeClass(fontSizePx, minSizePx, true),
        "nodrag transition",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onRemove?.();
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
