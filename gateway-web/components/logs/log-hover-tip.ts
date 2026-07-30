"use client";

export const LOG_HOVER_TIP_HIDE_MS = 280;

export function computeLogHoverTipPos(
  rect: DOMRect,
  opts?: { tipWidth?: number; tipMaxH?: number },
) {
  const tipWidth = opts?.tipWidth ?? 720;
  const tipMaxH = opts?.tipMaxH ?? 680;
  const width = Math.min(tipWidth, window.innerWidth - 32);
  let left = rect.left - width - 14;
  if (left < 16) {
    left = Math.min(rect.right + 14, window.innerWidth - width - 16);
  }
  const maxH = Math.min(tipMaxH, window.innerHeight - 24);
  const top = Math.min(rect.top, window.innerHeight - maxH);
  return {
    top: Math.max(12, top),
    left: Math.max(12, left),
    width,
  };
}

export const logHoverTipFixedStyle = {
  position: "fixed" as const,
  zIndex: 10000,
};
