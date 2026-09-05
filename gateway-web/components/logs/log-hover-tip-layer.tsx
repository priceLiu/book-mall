"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { logHoverTipFixedStyle } from "./log-hover-tip";

/** 悬停预览：portal 到 body，避免表格行刷新时 React removeChild 冲突 */
export function LogHoverTipLayer({
  open,
  pos,
  className,
  ariaLabel,
  tipHover,
  children,
}: {
  open: boolean;
  pos: { top: number; left: number; width: number } | null;
  className?: string;
  ariaLabel?: string;
  tipHover: { onMouseEnter: () => void; onMouseLeave: () => void };
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || !pos) return null;

  const style: CSSProperties = {
    ...logHoverTipFixedStyle,
    top: pos.top,
    left: pos.left,
    width: pos.width,
  };

  return createPortal(
    <div
      className={className}
      style={style}
      onMouseEnter={tipHover.onMouseEnter}
      onMouseLeave={tipHover.onMouseLeave}
      role="dialog"
      aria-label={ariaLabel}
    >
      {children}
    </div>,
    document.body,
  );
}
