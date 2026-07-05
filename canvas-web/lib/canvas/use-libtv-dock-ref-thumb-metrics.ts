"use client";

import { useMemo } from "react";
import {
  DOCK_HEADER_MARK_BTN_SCREEN_H,
  DOCK_HEADER_MARK_BTN_SCREEN_W,
  DOCK_REF_CORNER_BADGE_FONT_SCREEN,
  DOCK_REF_CORNER_BADGE_MIN_SCREEN,
  DOCK_REF_THUMB_SCREEN_SIZE,
  VIDEO_DOCK_HEADER_CHIP_MIN_HEIGHT_AT_100,
} from "@/lib/canvas/libtv-dock-scale";

/**
 * Dock 顶栏缩略图 / 标记 · 与底栏字号同一策略：
 * flow 内直接用目标屏 px（Pro2InputDockShell 外层 invScale 负责缩到屏上恒定尺寸）。
 */
export function useLibtvDockRefThumbMetrics() {
  return useMemo(() => {
    const thumbSize = DOCK_REF_THUMB_SCREEN_SIZE;
    const markBtnWidthPx = DOCK_HEADER_MARK_BTN_SCREEN_W;
    const markBtnHeightPx = DOCK_HEADER_MARK_BTN_SCREEN_H;
    /** 顶栏行高以缩略图为准；标记可略高但不撑大行高 */
    const headerMinHeightPx = thumbSize + 10;
    const thumbStyle = {
      width: thumbSize,
      height: thumbSize,
      minWidth: thumbSize,
      minHeight: thumbSize,
    } as const;
    const thumbClass =
      "group relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-[#262626]";
    return {
      actionBtnPx: markBtnWidthPx,
      markBtnWidthPx,
      markBtnHeightPx,
      thumbPx: thumbSize,
      thumbWidthPx: thumbSize,
      thumbHeightPx: thumbSize,
      thumbStyle,
      thumbClass,
      headerMinHeightPx,
      chipMinHeightPx: VIDEO_DOCK_HEADER_CHIP_MIN_HEIGHT_AT_100,
      badgeFontPx: DOCK_REF_CORNER_BADGE_FONT_SCREEN,
      badgeMinPx: DOCK_REF_CORNER_BADGE_MIN_SCREEN,
      logoIconPx: 60,
      logoLabelFontPx: 11,
    };
  }, []);
}
