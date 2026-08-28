"use client";

import { useMemo, useRef } from "react";
import { useNodes } from "@xyflow/react";
import {
  resolveLibtvSoleSelectedNodeId,
} from "./libtv-floating-dock-selection";
import { useCanvasMarqueeSelecting } from "./use-canvas-marquee-selecting";
import { useCanvasStore } from "./store";
import {
  useLibtvDockFlowPlacement,
  useStableLibtvDockFlowPlacement,
  type LibtvDockFlowPlacement,
} from "./libtv-dock-flow-placement";
import { libtvFloatingDockHidden } from "./use-viewport-transform-active";

type PlacementOpts = NonNullable<Parameters<typeof useLibtvDockFlowPlacement>[1]>;

/**
 * LibTV 浮动 Dock · 某类型节点的选中 id（全局单选互斥）
 *
 * 优先 RF 唯一选中；sync/zoom 时 RF 选中可能闪断，回退 store pin。
 */
export function useLibtvSoleSelectedNodeId(nodeType: string): string | null {
  const rfNodes = useNodes();
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const pinnedId = useCanvasStore((s) => s.libtvFloatingDockNodeId);
  const pinnedType = useCanvasStore((s) => s.libtvFloatingDockNodeType);

  return useMemo(
    () =>
      resolveLibtvSoleSelectedNodeId(
        rfNodes,
        nodeType,
        { nodeId: pinnedId, nodeType: pinnedType },
        { marqueeSelecting },
      ),
    [rfNodes, nodeType, pinnedId, pinnedType, marqueeSelecting],
  );
}

/**
 * LibTV 浮动输入坞 · 统一控制器（Pro2 + sbv1 所有节点须用此 hook）
 *
 * - 仅 position 拖动「所属节点」时 hidden
 * - pan / zoom / resize / 拖其它节点：Dock 保持显示与内容状态
 * - placement 短暂丢失时保留上一帧锚点，避免 pan/zoom 时卸载
 */
export function useLibtvFloatingDock(
  dockNodeId: string | null,
  placementOpts?: PlacementOpts,
): {
  placement: LibtvDockFlowPlacement | null;
  hidden: boolean;
  /** 可渲染 Dock（有节点 id 且锚点可用或已 pin） */
  active: boolean;
} {
  const hidden = useCanvasStore((s) =>
    libtvFloatingDockHidden(s.canvasDraggingNodeId, dockNodeId),
  );
  const marqueeSelecting = useCanvasMarqueeSelecting();

  const rawPlacement = useLibtvDockFlowPlacement(dockNodeId, placementOpts, hidden);
  const stablePlacement = useStableLibtvDockFlowPlacement(rawPlacement);

  const pinRef = useRef<{
    nodeId: string;
    placement: LibtvDockFlowPlacement;
  } | null>(null);

  if (dockNodeId && stablePlacement && !hidden) {
    pinRef.current = { nodeId: dockNodeId, placement: stablePlacement };
  } else if (!dockNodeId) {
    pinRef.current = null;
  }

  const placement =
    stablePlacement ??
    (dockNodeId && pinRef.current?.nodeId === dockNodeId
      ? pinRef.current.placement
      : null);

  const active = Boolean(dockNodeId && placement && !marqueeSelecting);

  return {
    placement,
    hidden,
    active,
  };
}

/** 自定义锚点（分镜格等）时仅复用 hidden 规则 */
export function useLibtvFloatingDockHidden(dockNodeId: string | null): boolean {
  return useCanvasStore((s) =>
    libtvFloatingDockHidden(s.canvasDraggingNodeId, dockNodeId),
  );
}
