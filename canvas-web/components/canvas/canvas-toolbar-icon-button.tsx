"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CANVAS_TOOLBAR_ICON_BTN_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import {
  CanvasToolbarTooltip,
  canvasToolbarTooltipTitle,
} from "@/components/canvas/canvas-toolbar-tooltip";

/** 顶栏纯图标按钮 · 悬停展示说明 */
export function CanvasToolbarIconButton({
  label,
  hint,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const title = canvasToolbarTooltipTitle(label, hint);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        CANVAS_TOOLBAR_ICON_BTN_CLASS,
        "group/canvas-tb-tip relative",
        disabled && "opacity-50",
        className,
      )}
    >
      {children}
      <CanvasToolbarTooltip label={label} hint={hint} />
    </button>
  );
}
