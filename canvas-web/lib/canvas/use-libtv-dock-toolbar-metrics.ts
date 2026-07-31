"use client";

import { createContext, useContext, useMemo } from "react";
import {
  LIBTV_DOCK_FLOW_WIDTH,
  LIBTV_DOCK_SCREEN_W_BASE,
  VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100,
} from "@/lib/canvas/libtv-dock-scale";

/**
 * Dock 外壳把 flow 尺寸按此比例缩到屏上；画布外（弹层）复用底栏组件时
 * 没有这层 invScale，须直接按缩放后的屏 px 渲染，否则字号会大一倍多。
 */
export const LIBTV_DOCK_TOOLBAR_SCREEN_SCALE =
  LIBTV_DOCK_SCREEN_W_BASE / LIBTV_DOCK_FLOW_WIDTH;

/** 1 = flow 内（由外壳 invScale 缩放）；见 LibtvDockToolbarMetricsContext */
export const LibtvDockToolbarMetricsContext = createContext(1);

/**
 * Dock 底栏 · 与视频节点 footer 一致：flow 内直接用目标屏 px 作 fontSize，
 * 由 Pro2InputDockShell 外层 invScale 缩到屏上恒定尺寸（避免 context 晚到导致字号闪变）。
 */
export function useLibtvDockToolbarMetrics() {
  const scale = useContext(LibtvDockToolbarMetricsContext);
  return useMemo(() => {
    const px = (base: number) => Math.round(base * scale);
    return {
      fontPx: px(VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100),
      minHeightPx: px(48),
      sendBtnPx: px(48),
      sendIconPx: px(18),
      chevronPx: px(18),
      fontScreenPx: px(VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100),
    };
  }, [scale]);
}
