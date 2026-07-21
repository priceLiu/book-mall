"use client";

import { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import {
  useLibtvNodeToolbarHidden,
  useLibtvNodeToolbarScreenPlacement,
} from "@/lib/canvas/use-libtv-node-toolbar-placement";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import {
  computeLibtvPortaledToolbarScale,
  LIBTV_TOOLBAR_PORTAL_GAP_PX,
} from "@/lib/canvas/libtv-node-toolbar-scale";

/** Portal 内顶栏 · 不再施加内联 scale（由 portal 外层统一 transform） */
export const LibtvToolbarPortaledContext = createContext(false);

export function useLibtvToolbarPortaled(): boolean {
  return useContext(LibtvToolbarPortaledContext);
}

/** LibTV 节点顶栏 · portal 到 body，始终在节点上方、不被相邻节点遮挡 */
export function LibtvNodeToolbarPortal({
  nodeId,
  visible,
  children,
}: {
  nodeId: string;
  visible: boolean;
  children: React.ReactNode;
}) {
  const mounted = useClientPortalMounted();
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const effectiveVisible = visible && !marqueeSelecting;
  const placement = useLibtvNodeToolbarScreenPlacement(nodeId, effectiveVisible);
  const hidden = useLibtvNodeToolbarHidden(nodeId);
  const zoom = useStore((s) => s.transform[2]);
  const toolbarScale = computeLibtvPortaledToolbarScale(zoom);

  if (!mounted || !effectiveVisible || !placement) return null;

  const translateY =
    placement.place === "below"
      ? `${LIBTV_TOOLBAR_PORTAL_GAP_PX}px`
      : `calc(-100% - ${LIBTV_TOOLBAR_PORTAL_GAP_PX}px)`;

  return createPortal(
    <LibtvToolbarPortaledContext.Provider value={true}>
      <div
        className="fixed z-[1500] flex justify-center"
        style={{
          left: placement.x,
          top: placement.y,
          transform: `translate(-50%, ${translateY}) scale(${toolbarScale})`,
          transformOrigin: placement.place === "below" ? "center top" : "center bottom",
          visibility: hidden ? "hidden" : "visible",
          pointerEvents: hidden ? "none" : "auto",
        }}
      >
        {children}
      </div>
    </LibtvToolbarPortaledContext.Provider>,
    document.body,
  );
}
