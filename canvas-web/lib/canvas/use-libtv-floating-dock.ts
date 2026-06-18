"use client";

import { useMemo, useRef } from "react";
import { useNodes } from "@xyflow/react";
import { useCanvasStore } from "./store";
import {
  useLibtvDockFlowPlacement,
  useStableLibtvDockFlowPlacement,
  type LibtvDockFlowPlacement,
} from "./libtv-dock-flow-placement";
import { libtvFloatingDockHidden } from "./use-viewport-transform-active";

type PlacementOpts = NonNullable<Parameters<typeof useLibtvDockFlowPlacement>[1]>;

function soleSelectedNodeIdOfType(
  nodes: { id: string; type?: string; selected?: boolean }[],
  nodeType: string,
): string | null {
  let found: string | null = null;
  let count = 0;
  for (const n of nodes) {
    if (n.selected && n.type === nodeType) {
      count += 1;
      found = n.id;
      if (count > 1) return null;
    }
  }
  return count === 1 ? found : null;
}

/**
 * LibTV 浮动 Dock · 选中节点 id（RF 优先，store 钉选 fallback）
 *
 * LibTV 选中态在 RF；pan/zoom 时可能闪断。`setLibtvFloatingDockSelection` 在 select 变更时写入 store。
 */
export function useLibtvSoleSelectedNodeId(nodeType: string): string | null {
  const rfNodes = useNodes();

  const pinnedId = useCanvasStore(
    (s) =>
      s.libtvFloatingDockNodeType === nodeType ? s.libtvFloatingDockNodeId : null,
    (a, b) => a === b,
  );

  const rfId = useMemo(
    () => soleSelectedNodeIdOfType(rfNodes, nodeType),
    [rfNodes, nodeType],
  );

  return rfId ?? pinnedId;
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

  const rawPlacement = useLibtvDockFlowPlacement(dockNodeId, placementOpts);
  const stablePlacement = useStableLibtvDockFlowPlacement(rawPlacement);

  const pinRef = useRef<{
    nodeId: string;
    placement: LibtvDockFlowPlacement;
  } | null>(null);

  if (dockNodeId && stablePlacement) {
    pinRef.current = { nodeId: dockNodeId, placement: stablePlacement };
  }

  const placement =
    stablePlacement ??
    (dockNodeId && pinRef.current?.nodeId === dockNodeId
      ? pinRef.current.placement
      : null);

  const active = Boolean(dockNodeId && placement);

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
