"use client";

import { useEffect, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";
import { isSbv1MediaGroup } from "@/lib/canvas/sbv1-media-group-meta";
import {
  findSbv1GroupLinkedVideoEngine,
  relayoutSbv1MediaGroup,
} from "@/lib/canvas/sbv1-media-group-layout";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { Pro2MediaGroupToolbarPanel } from "../pro2/pro2-media-group-toolbar-panel";
import {
  pinPro2MediaGroupToolbarHover,
  schedulePro2MediaGroupToolbarHide,
} from "@/lib/canvas/pro2-media-group-toolbar-hover";

const TOOLBAR_HEIGHT = 44;
const HEADER_RESERVED = 56;
const GAP = 8;

/** sbv1 参考图分组被选中 → 顶部工具条（壳层与 Pro2 媒体组一致） */
export function Sbv1MediaGroupToolbar({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const setNodes = useCanvasStore((s) => s.setNodes);
  const edges = useCanvasStore((s) => s.edges);
  const hoveredMediaGroupId = useCanvasStore((s) => s.hoveredMediaGroupId);
  const setHoveredMediaGroupId = useCanvasStore((s) => s.setHoveredMediaGroupId);
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const marqueeSelecting = useCanvasMarqueeSelecting();

  const group = useMemo(() => {
    const hasNonGroupSelected = rfNodes.some(
      (n) => n.selected && n.type !== "group",
    );
    if (hasNonGroupSelected) return null;
    const selected = rfNodes.find((n) => n.selected && n.type === "group");
    const target =
      selected ??
      (hoveredMediaGroupId
        ? rfNodes.find(
            (n) => n.id === hoveredMediaGroupId && n.type === "group",
          )
        : undefined);
    if (!target) return null;
    if (!isSbv1MediaGroup(target, rfNodes)) return null;
    return target;
  }, [rfNodes, hoveredMediaGroupId]);

  // 选中组时：若视频引擎在组外但已连线，纳入组内并排布（悬停预览顶栏时不重排）
  useEffect(() => {
    if (!group?.selected) return;
    const nodes = useCanvasStore.getState().nodes;
    const linked = findSbv1GroupLinkedVideoEngine(group.id, nodes, edges);
    if (linked && linked.parentId !== group.id) {
      relayoutSbv1MediaGroup(setNodes, group.id, edges);
    }
  }, [group?.id, group?.selected, edges, setNodes, group]);

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

  if (marqueeSelecting || viewportMoving || !group || !placement) return null;

  const keepHover = () =>
    pinPro2MediaGroupToolbarHover(group.id, setHoveredMediaGroupId);
  const releaseHover = () => {
    if (group.selected) return;
    schedulePro2MediaGroupToolbarHide(group.id, () => {
      if (useCanvasStore.getState().hoveredMediaGroupId === group.id) {
        setHoveredMediaGroupId(null);
      }
    });
  };

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
      onPointerEnter={keepHover}
      onPointerLeave={releaseHover}
      onPointerDown={keepHover}
    >
      <Pro2MediaGroupToolbarPanel
        groupId={group.id}
        kind={null}
        edition="sbv1"
        onRelayout={() => relayoutSbv1MediaGroup(setNodes, group.id, edges)}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
