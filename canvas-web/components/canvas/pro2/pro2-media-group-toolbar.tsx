"use client";

import { useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";
import { isPro2CharacterBoardGroup } from "@/lib/canvas/pro2-resolve-character-board-group";
import { isPro2FrameBoardGroup } from "@/lib/canvas/pro2-resolve-frame-board-group";
import { isPro2VideoBoardGroup } from "@/lib/canvas/pro2-resolve-video-board-group";
import { isPro2StyledGroup } from "@/lib/canvas/pro2-media-group-meta";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { Pro2MediaGroupToolbarPanel } from "./pro2-media-group-toolbar-panel";

const TOOLBAR_HEIGHT = 44;
const HEADER_RESERVED = 56;
const GAP = 8;

/**
 * Pro2 媒体组 · 仅单击选中组时显示顶部工具条（不随鼠标悬停出现）。
 */
export function Pro2MediaGroupToolbar({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const marqueeSelecting = useCanvasMarqueeSelecting();

  const resolved = useMemo(() => {
    const hasNonGroupSelected = rfNodes.some(
      (n) => n.selected && n.type !== "group",
    );
    if (hasNonGroupSelected) return null;
    const selectedGroup = rfNodes.find(
      (n) => n.selected && n.type === "group",
    );
    if (!selectedGroup) return null;
    if (!isPro2StyledGroup(selectedGroup, rfNodes)) return null;
    if (isPro2CharacterBoardGroup(selectedGroup, rfNodes)) {
      return { group: selectedGroup, kind: "character-board" as const };
    }
    if (isPro2FrameBoardGroup(selectedGroup, rfNodes)) {
      return { group: selectedGroup, kind: "frame-board" as const };
    }
    if (isPro2VideoBoardGroup(selectedGroup, rfNodes)) {
      return { group: selectedGroup, kind: "video-board" as const };
    }
    return { group: selectedGroup, kind: null };
  }, [rfNodes]);

  const viewport = useViewportTransformActive(Boolean(resolved) && !viewportMoving);

  const placement = useMemo(() => {
    if (!resolved) return null;
    const internal = getInternalNode(resolved.group.id) as
      | {
          measured?: { width?: number; height?: number };
          position: { x: number; y: number };
          internals?: { positionAbsolute?: { x: number; y: number } };
          width?: number;
          height?: number;
        }
      | undefined;
    const g = resolved.group;
    const style = g.style as { width?: number; height?: number } | undefined;
    const w =
      internal?.measured?.width ??
      (typeof internal?.width === "number" ? internal.width : undefined) ??
      (typeof g.width === "number" ? g.width : undefined) ??
      style?.width ??
      360;
    const h =
      internal?.measured?.height ??
      (typeof internal?.height === "number" ? internal.height : undefined) ??
      (typeof g.height === "number" ? g.height : undefined) ??
      style?.height ??
      240;
    const pos =
      internal?.internals?.positionAbsolute ??
      internal?.position ??
      g.position;
    if (!pos) return null;
    const cx = pos.x + w / 2;
    const top = flowToScreenPosition({ x: cx, y: pos.y });
    const bottom = flowToScreenPosition({ x: cx, y: pos.y + h });
    if (top.y - TOOLBAR_HEIGHT - GAP < HEADER_RESERVED) {
      return { x: bottom.x, y: bottom.y + GAP, place: "below" as const };
    }
    return { x: top.x, y: top.y - GAP, place: "above" as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, getInternalNode, flowToScreenPosition, rfNodes, viewport]);

  if (marqueeSelecting || viewportMoving || !resolved || !placement) return null;

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
        groupId={resolved.group.id}
        kind={resolved.kind}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
