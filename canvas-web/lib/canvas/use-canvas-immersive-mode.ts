"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOP_REVEAL_ZONE_PX = 56;
const TOP_HIDE_DELAY_MS = 2200;

/** 画布沉浸全屏：隐藏顶栏，鼠标移入顶部区域再显示 */
export function useCanvasImmersiveMode(rootRef: React.RefObject<HTMLElement | null>) {
  const [immersive, setImmersive] = useState(false);
  const [topChromeVisible, setTopChromeVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHideTopChrome = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setTopChromeVisible(false);
    }, TOP_HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const exitImmersive = useCallback(async () => {
    setImmersive(false);
    setTopChromeVisible(true);
    clearHideTimer();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }, [clearHideTimer]);

  const enterImmersive = useCallback(async () => {
    setImmersive(true);
    setTopChromeVisible(false);
    const el = rootRef.current;
    if (el && document.fullscreenEnabled && !document.fullscreenElement) {
      try {
        await el.requestFullscreen();
      } catch {
        // 浏览器拒绝全屏时仍进入「隐藏顶栏」模式
      }
    }
    scheduleHideTopChrome();
  }, [rootRef, scheduleHideTopChrome]);

  const toggleImmersive = useCallback(async () => {
    if (immersive) {
      await exitImmersive();
    } else {
      await enterImmersive();
    }
  }, [immersive, enterImmersive, exitImmersive]);

  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void exitImmersive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [immersive, exitImmersive]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && immersive) {
        setImmersive(false);
        setTopChromeVisible(true);
        clearHideTimer();
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [immersive, clearHideTimer]);

  useEffect(() => {
    if (!immersive) return;

    const onMove = (e: MouseEvent) => {
      if (e.clientY <= TOP_REVEAL_ZONE_PX) {
        setTopChromeVisible(true);
        clearHideTimer();
        return;
      }
      scheduleHideTopChrome();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearHideTimer();
    };
  }, [immersive, clearHideTimer, scheduleHideTopChrome]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  return {
    immersive,
    topChromeVisible,
    toggleImmersive,
    exitImmersive,
  };
}
