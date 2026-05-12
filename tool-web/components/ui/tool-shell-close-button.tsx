"use client";

import { cn } from "@/lib/utils";

/**
 * 工具站统一关闭按钮：圆形黑底 ×（见 doc/tech/ui-shell-conventions.md）。
 * `floating`：用于灯箱等叠放在大图角落的场景。
 */
export function ToolShellCloseButton({
  onClick,
  label = "关闭",
  floating,
  className,
}: {
  onClick: () => void;
  label?: string;
  floating?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "tool-close-btn",
        floating && "tool-close-btn--floating",
        className,
      )}
      aria-label={label}
      onClick={onClick}
    >
      <span aria-hidden className="tool-close-btn-glyph">
        ×
      </span>
    </button>
  );
}
