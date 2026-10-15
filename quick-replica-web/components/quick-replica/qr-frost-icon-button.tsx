"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type QrFrostIconButtonSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<QrFrostIconButtonSize, string> = {
  sm: "qr-frost-icon-btn qr-frost-icon-btn--sm",
  md: "qr-frost-icon-btn",
  lg: "qr-frost-icon-btn qr-frost-icon-btn--lg",
};

/** 磨砂圆钮 · 图标随视口缩放（全站统一） */
export function QrFrostIconButton({
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: QrFrostIconButtonSize;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${SIZE_CLASS[size]} ${className}`.trim()}
      {...props}
    >
      <span className="qr-frost-icon-btn__icon">{children}</span>
    </button>
  );
}
