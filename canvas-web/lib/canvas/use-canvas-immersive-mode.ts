"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOP_REVEAL_ZONE_PX = 56;
const TOP_HIDE_DELAY_MS = 2200;

/** 画布沉浸全屏：隐藏顶栏，鼠标移入顶部区域再显示 */
export function useCanvasImmersiveMode(
  _rootRef?: React.RefObject<HTMLElement | null>,
) {
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
    // 关键：对 documentElement（<html>）请求全屏，而非画布容器。
    // 画布容器本身已是 fixed inset-0 占满视口；若把容器设为全屏元素，
    // 所有 createPortal 到 document.body 的 UI（底部 Dock 的「+」菜单、节点浮动
    // 工具条、双击画布的右键/上下文菜单等）都不在全屏子树内 → 全屏下不可见/失效。
    // 改对 <html> 全屏后，body 及其下所有 portal 仍在全屏子树内，菜单恢复正常。
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // 浏览器拒绝全屏时仍进入「隐藏顶栏」模式
      }
    }
    scheduleHideTopChrome();
  }, [scheduleHideTopChrome]);

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
