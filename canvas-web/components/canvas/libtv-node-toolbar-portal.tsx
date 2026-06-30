"use client";

import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { useLibtvNodeToolbarScreenPlacement } from "@/lib/canvas/use-libtv-node-toolbar-placement";
import { computeLibtvNodeToolbarTransformScale } from "@/lib/canvas/libtv-node-toolbar-scale";

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
  const placement = useLibtvNodeToolbarScreenPlacement(nodeId, visible);
  const zoom = useStore((s) => s.transform[2]);
  const toolbarScale = computeLibtvNodeToolbarTransformScale(zoom);

  if (!mounted || !visible || !placement) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[1500]"
      style={{
        left: placement.x,
        top: placement.y,
        transform: `translate(-50%, -100%) scale(${toolbarScale})`,
        transformOrigin: "center bottom",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
