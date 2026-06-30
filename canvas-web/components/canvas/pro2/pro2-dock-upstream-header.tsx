"use client";

import type { ReactNode } from "react";
import { Pro2DockHeader } from "@/components/canvas/pro2/pro2-input-dock-shell";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";

/** 上游参考图顶栏 · 与视频 Dock 一致的 compact 高度与缩略图 metrics */
export function Pro2DockUpstreamHeader({
  refRow,
  actionRow,
}: {
  refRow?: ReactNode;
  actionRow?: ReactNode;
}) {
  const { headerMinHeightPx } = useLibtvDockRefThumbMetrics();
  return (
    <Pro2DockHeader
      compact
      minHeightPx={headerMinHeightPx}
      refRow={
        refRow ? (
          <div className="hide-scroll-bar flex min-w-0 items-start gap-1.5 overflow-x-auto">
            {refRow}
          </div>
        ) : null
      }
      actionRow={actionRow}
    />
  );
}
