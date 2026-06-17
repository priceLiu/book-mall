"use client";

import { useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";
import { isPro2CharacterBoardGroup } from "@/lib/canvas/pro2-resolve-character-board-group";
import { isPro2FrameBoardGroup } from "@/lib/canvas/pro2-resolve-frame-board-group";
import { isPro2StyledGroup } from "@/lib/canvas/pro2-media-group-meta";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { Pro2MediaGroupToolbarPanel } from "./pro2-media-group-toolbar-panel";

const TOOLBAR_HEIGHT = 44;
const HEADER_RESERVED = 56;
const GAP = 8;

/**
 * 图 2 · Pro2 媒体组（角色三视图 / 分镜图）被直接选中 → 顶部统一工具条。
 * 坐标用 internal-node 绝对坐标（与框选条同一算法），避免 DOM 量位丢失。
 */
export function Pro2MediaGroupToolbar({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);

  const resolved = useMemo(() => {
    // 有非组节点被选中时（框选 / 多选）→ 让位给框选工具条，避免双条
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

  if (viewportMoving || !resolved || !placement) return null;

  return (
    <Pro2MediaGroupToolbarPanel
      groupId={resolved.group.id}
      kind={resolved.kind}
      className="fixed z-[1300]"
      style={{
        left: placement.x,
        top: placement.y,
        transform: `translate(-50%, ${placement.place === "above" ? "-100%" : "0%"})`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
