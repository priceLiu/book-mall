"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useReactFlow } from "@xyflow/react";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { useViewportTransformActive } from "@/lib/canvas/use-viewport-transform-active";
import { useCanvasStore } from "@/lib/canvas/store";
import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { isPro2CharacterBoardGroup } from "@/lib/canvas/pro2-resolve-character-board-group";
import { isPro2FrameBoardGroup } from "@/lib/canvas/pro2-resolve-frame-board-group";
import { isPro2VideoBoardGroup } from "@/lib/canvas/pro2-resolve-video-board-group";
import { inferPro2MediaGroupKind } from "@/lib/canvas/pro2-media-group-meta";
import { isSbv1MediaGroup } from "@/lib/canvas/sbv1-media-group-meta";
import { findSbv1GroupLinkedVideoEngine } from "@/lib/canvas/sbv1-media-group-layout";
import {
  pro2NodeAbsolutePosition,
  pro2NodeBoxSize,
} from "@/lib/canvas/pro2-selection-bbox";
import { LIBTV_TOOLBAR_PORTAL_GAP_PX } from "@/lib/canvas/libtv-node-toolbar-scale";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { Pro2MediaGroupToolbarPanel } from "./pro2-media-group-toolbar-panel";

const TOOLBAR_HEIGHT = 44;
const HEADER_RESERVED = 56;
const SCREEN_PAD = 12;

function clampGroupToolbarScreenPos(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  const minY = HEADER_RESERVED + TOOLBAR_HEIGHT + SCREEN_PAD;
  return {
    x: Math.min(window.innerWidth - SCREEN_PAD, Math.max(SCREEN_PAD, x)),
    y: Math.min(window.innerHeight - SCREEN_PAD, Math.max(minY, y)),
  };
}

/**
 * LibTV 媒体组顶栏（Pro2 + sbv1 统一）· 仅单击选中组时显示。
 */
export function Pro2MediaGroupToolbar({
  rfNodes,
}: {
  rfNodes: CanvasFlowNode[];
}) {
  const mounted = useClientPortalMounted();
  const reparentNode = useCanvasStore((s) => s.reparentNode);
  const edges = useCanvasStore((s) => s.edges);
  const storeNodes = useCanvasStore((s) => s.nodes);
  const { flowToScreenPosition, getInternalNode } = useReactFlow();
  const draggingNodeId = useCanvasStore((s) => s.canvasDraggingNodeId);
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

    if (isSbv1MediaGroup(selectedGroup, rfNodes)) {
      return {
        group: selectedGroup,
        kind: null,
        edition: "sbv1" as const,
      };
    }

    if (isPro2CharacterBoardGroup(selectedGroup, rfNodes)) {
      return {
        group: selectedGroup,
        kind: "character-board" as const,
        edition: "pro2" as const,
      };
    }
    if (isPro2FrameBoardGroup(selectedGroup, rfNodes)) {
      return {
        group: selectedGroup,
        kind: "frame-board" as const,
        edition: "pro2" as const,
      };
    }
    if (isPro2VideoBoardGroup(selectedGroup, rfNodes)) {
      return {
        group: selectedGroup,
        kind: "video-board" as const,
        edition: "pro2" as const,
      };
    }
    const childIds = rfNodes
      .filter((n) => n.parentId === selectedGroup.id && n.type !== "group")
      .map((n) => n.id);
    const inferred = inferPro2MediaGroupKind(rfNodes, childIds);
    return {
      group: selectedGroup,
      kind: inferred,
      edition: "pro2" as const,
    };
  }, [rfNodes]);

  useEffect(() => {
    if (!resolved?.group.selected || resolved.edition !== "sbv1") return;
    const nodes = useCanvasStore.getState().nodes;
    const linked = findSbv1GroupLinkedVideoEngine(
      resolved.group.id,
      nodes,
      edges,
    );
    if (linked && linked.parentId !== resolved.group.id) {
      reparentNode(linked.id, resolved.group.id);
    }
  }, [
    resolved?.group.id,
    resolved?.group.selected,
    resolved?.edition,
    edges,
    reparentNode,
    resolved?.group,
  ]);

  const hideForGroupPositionDrag =
    Boolean(resolved) &&
    Boolean(draggingNodeId) &&
    draggingNodeId === resolved?.group.id;

  const viewport = useViewportTransformActive(Boolean(resolved));

  const placement = useMemo(() => {
    if (!resolved) return null;
    const g = resolved.group;
    const internal = getInternalNode(g.id) as
      | {
          measured?: { width?: number; height?: number };
          position: { x: number; y: number };
          internals?: { positionAbsolute?: { x: number; y: number } };
          width?: number;
          height?: number;
        }
      | undefined;

    const { w, h } = pro2NodeBoxSize(g);
    const pos =
      internal?.internals?.positionAbsolute ??
      internal?.position ??
      pro2NodeAbsolutePosition(g, storeNodes.length ? storeNodes : rfNodes);

    const width =
      internal?.measured?.width ??
      (typeof internal?.width === "number" ? internal.width : undefined) ??
      w;
    const height =
      internal?.measured?.height ??
      (typeof internal?.height === "number" ? internal.height : undefined) ??
      h;

    const cx = pos.x + width / 2;
    const top = flowToScreenPosition({ x: cx, y: pos.y });
    const bottom = flowToScreenPosition({ x: cx, y: pos.y + height });

    let place: "above" | "below" = "above";
    let rawX = top.x;
    let rawY = top.y - LIBTV_TOOLBAR_PORTAL_GAP_PX;
    if (top.y - TOOLBAR_HEIGHT - LIBTV_TOOLBAR_PORTAL_GAP_PX < HEADER_RESERVED) {
      place = "below";
      rawX = bottom.x;
      rawY = bottom.y + LIBTV_TOOLBAR_PORTAL_GAP_PX;
    }

    const clamped = clampGroupToolbarScreenPos(rawX, rawY);
    return { ...clamped, place };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    resolved,
    getInternalNode,
    flowToScreenPosition,
    rfNodes,
    storeNodes,
    viewport,
  ]);

  if (
    marqueeSelecting ||
    hideForGroupPositionDrag ||
    !resolved ||
    !placement ||
    !mounted
  ) {
    return null;
  }

  const translateY =
    placement.place === "below"
      ? `${LIBTV_TOOLBAR_PORTAL_GAP_PX}px`
      : `calc(-100% - ${LIBTV_TOOLBAR_PORTAL_GAP_PX}px)`;

  return createPortal(
    <div
      className="pointer-events-auto fixed z-[1600] flex justify-center"
      style={{
        left: placement.x,
        top: placement.y,
        transform: `translate(-50%, ${translateY})`,
        transformOrigin:
          placement.place === "below" ? "center top" : "center bottom",
        padding: "14px 20px",
        margin: "-14px -20px",
      }}
    >
      <Pro2MediaGroupToolbarPanel
        groupId={resolved.group.id}
        kind={resolved.kind}
        edition={resolved.edition}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
