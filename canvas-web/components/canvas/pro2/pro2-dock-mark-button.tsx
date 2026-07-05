"use client";

import { MapPin } from "lucide-react";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";

/** Dock 顶栏 · 标记占位钮（118×188 屏上恒定） */
export function Pro2DockMarkButton() {
  const { markBtnWidthPx, markBtnHeightPx, logoIconPx, logoLabelFontPx } =
    useLibtvDockRefThumbMetrics();

  return (
    <button
      type="button"
      disabled
      title="标记（即将推出）"
      className="nodrag flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] text-white/35"
      style={{
        width: markBtnWidthPx,
        height: markBtnHeightPx,
        minWidth: markBtnWidthPx,
        minHeight: markBtnHeightPx,
        fontSize: logoLabelFontPx,
      }}
    >
      <MapPin
        style={{ width: logoIconPx, height: logoIconPx }}
        strokeWidth={1.75}
      />
      <span>标记</span>
    </button>
  );
}
