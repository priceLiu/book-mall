"use client";

import { useEffect, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";
import { isSbv1MediaGroup } from "@/lib/canvas/sbv1-media-group-meta";
import { findSbv1GroupLinkedVideoEngine } from "@/lib/canvas/sbv1-media-group-layout";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { Pro2MediaGroupToolbarPanel } from "../pro2/pro2-media-group-toolbar-panel";

const TOOLBAR_HEIGHT = 44;
const HEADER_RESERVED = 56;
const GAP = 8;

/** sbv1 参考图分组 · 仅单击选中组时显示顶部工具条（拖动中隐藏，松手恢复） */
export function Sbv1MediaGroupToolbar({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const reparentNode = useCanvasStore((s) => s.reparentNode);
  const edges = useCanvasStore((s) => s.edges);
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const geometryDragging = useCanvasStore((s) => s.canvasGeometryDragging);
  const marqueeSelecting = useCanvasMarqueeSelecting();

  const group = useMemo(() => {
    const hasNonGroupSelected = rfNodes.some(
      (n) => n.selected && n.type !== "group",
    );
    if (hasNonGroupSelected) return null;
    const selected = rfNodes.find((n) => n.selected && n.type === "group");
    if (!selected) return null;
    if (!isSbv1MediaGroup(selected, rfNodes)) return null;
    return selected;
  }, [rfNodes]);

  useEffect(() => {
    if (!group?.selected) return;
    const nodes = useCanvasStore.getState().nodes;
    const linked = findSbv1GroupLinkedVideoEngine(group.id, nodes, edges);
    if (linked && linked.parentId !== group.id) {
      reparentNode(linked.id, group.id);
    }
  }, [group?.id, group?.selected, edges, reparentNode, group]);

  const viewport = useViewportTransformActive(Boolean(group) && !viewportMoving);

  const placement = useMemo(() => {
    if (!group) return null;
    const internal = getInternalNode(group.id) as
      | {
          measured?: { width?: number; height?: number };
          position: { x: number; y: number };
          internals?: { positionAbsolute?: { x: number; y: number } };
          width?: number;
          height?: number;
        }
      | undefined;
    const style = group.style as { width?: number; height?: number } | undefined;
    const w =
      internal?.measured?.width ??
      (typeof internal?.width === "number" ? internal.width : undefined) ??
      (typeof group.width === "number" ? group.width : undefined) ??
      style?.width ??
      360;
    const h =
      internal?.measured?.height ??
      (typeof internal?.height === "number" ? internal.height : undefined) ??
      (typeof group.height === "number" ? group.height : undefined) ??
      style?.height ??
      240;
    const pos =
      internal?.internals?.positionAbsolute ??
      internal?.position ??
      group.position;
    if (!pos) return null;
    const cx = pos.x + w / 2;
    const top = flowToScreenPosition({ x: cx, y: pos.y });
    const bottom = flowToScreenPosition({ x: cx, y: pos.y + h });
    if (top.y - TOOLBAR_HEIGHT - GAP < HEADER_RESERVED) {
      return { x: bottom.x, y: bottom.y + GAP, place: "below" as const };
    }
    return { x: top.x, y: top.y - GAP, place: "above" as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, getInternalNode, flowToScreenPosition, rfNodes, viewport]);

  if (
    marqueeSelecting ||
    viewportMoving ||
    geometryDragging ||
    !group ||
    !placement
  ) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed z-[1600]"
      style={{
        left: placement.x,
        top: placement.y,
        transform: `translate(-50%, ${placement.place === "above" ? "-100%" : "0%"})`,
        padding: "14px 20px",
        margin: "-14px -20px",
      }}
    >
      <Pro2MediaGroupToolbarPanel
        groupId={group.id}
        kind={null}
        edition="sbv1"
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
