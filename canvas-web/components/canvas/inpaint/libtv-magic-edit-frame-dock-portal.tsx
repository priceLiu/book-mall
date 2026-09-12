"use client";

import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { LibtvDockToolbarMetricsContext } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  LIBTV_FRAME_DOCK_GAP_PX,
  useMagicEditFrameDockPlacement,
} from "@/lib/canvas/use-magic-edit-frame-dock-placement";

/** 贴框 Dock 字号：相对主 Dock 缩小，再随画布 zoom 缩放 */
const FRAME_DOCK_METRICS_RATIO = 0.52;

function clampFrameDockZoom(zoom: number): number {
  return Math.min(1.25, Math.max(0.35, Number.isFinite(zoom) && zoom > 0 ? zoom : 1));
}

/** 扩图 / 裁剪 · 贴外框底边的独立 Dock（portal，随框移动） */
export function LibtvMagicEditFrameDockPortal({
  nodeId,
  visible,
  children,
}: {
  nodeId: string;
  visible: boolean;
  children: React.ReactNode;
}) {
  const mounted = useClientPortalMounted();
  const placement = useMagicEditFrameDockPlacement(nodeId, visible);
  const zoom = useStore((s) => s.transform[2]);
  const scale = clampFrameDockZoom(zoom);

  if (!mounted || !visible || !placement) return null;

  return createPortal(
    <div
      data-canvas-block-nav-gesture
      data-libtv-magic-edit-frame-dock
      className="pointer-events-none fixed z-[1400]"
      style={{
        left: placement.centerX,
        top: placement.bottomY + LIBTV_FRAME_DOCK_GAP_PX,
        transform: `translate(-50%, 0) scale(${scale})`,
        transformOrigin: "top center",
      }}
    >
      <LibtvDockToolbarMetricsContext.Provider value={FRAME_DOCK_METRICS_RATIO}>
        <div
          className="pointer-events-auto w-max max-w-[min(92vw,520px)]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </LibtvDockToolbarMetricsContext.Provider>
    </div>,
    document.body,
  );
}
