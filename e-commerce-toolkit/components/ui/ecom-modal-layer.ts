"use client";

import { useEffect, type MouseEvent as ReactMouseEvent } from "react";

/** 点击遮罩（空白处）关闭 · 与 EcomFullScreenOverlay / 模特库选择器一致 */
export function ecomModalBackdropMouseDown(
  onClose: () => void,
  options?: { disabled?: boolean },
) {
  return (event: ReactMouseEvent<HTMLElement>) => {
    if (options?.disabled) return;
    if (event.target === event.currentTarget) onClose();
  };
}

export function useEcomModalEscape(
  open: boolean,
  onClose: () => void,
  options?: { disabled?: boolean },
) {
  const disabled = options?.disabled ?? false;
  useEffect(() => {
    if (!open || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, disabled]);
}
