"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TIP_HIDE_MS = 280;

export function useLogHoverTip(opts?: {
  tipWidth?: number;
  tipMaxH?: number;
  enabled?: boolean;
}) {
  const tipWidth = opts?.tipWidth ?? 720;
  const tipMaxH = opts?.tipMaxH ?? 680;
  const enabled = opts?.enabled ?? true;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setPos(null);
    }, TIP_HIDE_MS);
  }, [clearHideTimer]);

  const showFromRect = useCallback(
    (rect: DOMRect) => {
      if (!enabled) return;
      clearHideTimer();
      const width = Math.min(tipWidth, window.innerWidth - 32);
      let left = rect.left - width - 14;
      if (left < 16) {
        left = Math.min(rect.right + 14, window.innerWidth - width - 16);
      }
      const maxH = Math.min(tipMaxH, window.innerHeight - 24);
      const top = Math.min(rect.top, window.innerHeight - maxH);
      setPos({ top: Math.max(12, top), left: Math.max(12, left) });
      setOpen(true);
    },
    [clearHideTimer, enabled, tipMaxH, tipWidth],
  );

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const bindAnchor = useCallback(
    (getRect: () => DOMRect | null) => ({
      onMouseEnter: () => {
        const rect = getRect();
        if (rect) showFromRect(rect);
      },
      onMouseLeave: scheduleHide,
    }),
    [scheduleHide, showFromRect],
  );

  const bindTip = useCallback(
    () => ({
      onMouseEnter: () => {
        clearHideTimer();
        setOpen(true);
      },
      onMouseLeave: scheduleHide,
    }),
    [clearHideTimer, scheduleHide],
  );

  return { open, pos, bindAnchor, bindTip, scheduleHide, clearHideTimer, setOpen };
}
