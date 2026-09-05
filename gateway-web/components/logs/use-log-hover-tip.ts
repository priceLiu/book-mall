"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  computeLogHoverTipPos,
  LOG_HOVER_TIP_HIDE_MS,
} from "./log-hover-tip";

/** 单元格内本地悬停预览（fixed 定位，无 portal / 无共享 Context） */
export function useLogHoverTip(opts?: {
  tipWidth?: number;
  tipMaxH?: number;
  enabled?: boolean;
}) {
  const tipWidth = opts?.tipWidth ?? 720;
  const tipMaxH = opts?.tipMaxH ?? 680;
  const enabled = opts?.enabled ?? true;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearHideTimer();
    setOpen(false);
    setPos(null);
  }, [clearHideTimer]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setOpen(false);
      setPos(null);
    }, LOG_HOVER_TIP_HIDE_MS);
  }, [clearHideTimer]);

  const showFromRect = useCallback(
    (rect: DOMRect) => {
      if (!enabled) return;
      clearHideTimer();
      setPos(computeLogHoverTipPos(rect, { tipWidth, tipMaxH }));
      setOpen(true);
    },
    [clearHideTimer, enabled, tipMaxH, tipWidth],
  );

  useEffect(() => {
    mountedRef.current = true;
    const closeAll = () => {
      clearHideTimer();
      setOpen(false);
      setPos(null);
    };
    window.addEventListener("gw-log-close-hover-tips", closeAll);
    return () => {
      mountedRef.current = false;
      clearHideTimer();
      setOpen(false);
      setPos(null);
      window.removeEventListener("gw-log-close-hover-tips", closeAll);
    };
  }, [clearHideTimer]);

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
      onMouseEnter: clearHideTimer,
      onMouseLeave: scheduleHide,
    }),
    [clearHideTimer, scheduleHide],
  );

  return { open, pos, bindAnchor, bindTip, close, clearHideTimer, scheduleHide };
}
