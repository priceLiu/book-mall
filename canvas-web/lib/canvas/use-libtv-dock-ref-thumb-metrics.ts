"use client";

import { useMemo } from "react";
import {
  libtvDockFixedFlowPx,
  libtvDockVideoHeaderScreenMetrics,
  VIDEO_DOCK_HEADER_CHIP_MIN_HEIGHT_AT_100,
} from "@/lib/canvas/libtv-dock-scale";
import { useLibtvInputDockUi } from "@/lib/canvas/libtv-input-dock-ui-context";

/** 视频 / 图片 Dock 顶栏 · 上游参考缩略图屏上尺寸（与 sbv1-video-engine-chat-input 一致） */
export function useLibtvDockRefThumbMetrics() {
  const { shellScreenScale, canvasZoom } = useLibtvInputDockUi();
  return useMemo(() => {
    const headerMetrics = libtvDockVideoHeaderScreenMetrics(canvasZoom);
    const thumbWidthPx = libtvDockFixedFlowPx(
      headerMetrics.thumbWidthScreenPx,
      shellScreenScale,
    );
    const thumbHeightPx = libtvDockFixedFlowPx(
      headerMetrics.thumbHeightScreenPx,
      shellScreenScale,
    );
    /** 方形按钮（风格 / 上传）用高度对齐缩略图行 */
    const thumbPx = thumbHeightPx;
    const chipMinHeightPx = libtvDockFixedFlowPx(
      VIDEO_DOCK_HEADER_CHIP_MIN_HEIGHT_AT_100,
      shellScreenScale,
    );
    const badgeFontPx = libtvDockFixedFlowPx(
      headerMetrics.badgeFontScreenPx,
      shellScreenScale,
    );
    const badgeMinPx = libtvDockFixedFlowPx(
      headerMetrics.badgeFontScreenPx + 6,
      shellScreenScale,
    );
    const headerMinHeightPx =
      thumbHeightPx + libtvDockFixedFlowPx(8, shellScreenScale);
    const thumbStyle = {
      width: thumbWidthPx,
      height: thumbHeightPx,
      minWidth: thumbWidthPx,
      minHeight: thumbHeightPx,
    } as const;
    const thumbClass =
      "group relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-[#262626]";
    return {
      thumbPx,
      thumbWidthPx,
      thumbHeightPx,
      thumbStyle,
      thumbClass,
      headerMinHeightPx,
      chipMinHeightPx,
      badgeFontPx,
      badgeMinPx,
    };
  }, [canvasZoom, shellScreenScale]);
}
