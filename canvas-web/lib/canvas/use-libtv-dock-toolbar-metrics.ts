"use client";

import { useMemo } from "react";
import { VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100 } from "@/lib/canvas/libtv-dock-scale";

/**
 * Dock 底栏 · 与视频节点 footer 一致：flow 内直接用目标屏 px 作 fontSize，
 * 由 Pro2InputDockShell 外层 invScale 缩到屏上恒定尺寸（避免 context 晚到导致字号闪变）。
 */
export function useLibtvDockToolbarMetrics() {
  return useMemo(() => {
    const fontScreen = VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100;
    return {
      fontPx: fontScreen,
      minHeightPx: 48,
      sendBtnPx: 44,
      sendIconPx: 18,
      chevronPx: 18,
      fontScreenPx: fontScreen,
    };
  }, []);
}
