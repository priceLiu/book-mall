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
 * LibTV 浮动 Dock · 选中节点 id（RF 优先，store fallback，短暂丢失时 latch）
 *
 * LibTV 画布 `preserveRfSelection` 下 RF 为选中真相源；勿仅读 zustand.selected。
 */
export function useLibtvSoleSelectedNodeId(nodeType: string): string | null {
  const rfNodes = useNodes();
  const latchedRef = useRef<string | null>(null);

  const rfId = useMemo(
    () => soleSelectedNodeIdOfType(rfNodes, nodeType),
    [rfNodes, nodeType],
  );

  const storeId = useCanvasStore(
    (s) => soleSelectedNodeIdOfType(s.nodes, nodeType),
    (a, b) => a === b,
  );

  const resolved = rfId ?? storeId;
  if (resolved) {
    latchedRef.current = resolved;
  } else if (rfId === null && storeId === null) {
    const anyRf = rfNodes.some((n) => n.selected && n.type === nodeType);
    if (!anyRf) latchedRef.current = null;
  }

  return resolved ?? latchedRef.current;
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
  /** 可渲染 Dock（选中节点且锚点可用或已 latch） */
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
  const latchedRef = useRef(false);

  if (dockNodeId && stablePlacement) {
    pinRef.current = { nodeId: dockNodeId, placement: stablePlacement };
    latchedRef.current = true;
  }
  if (!dockNodeId) {
    pinRef.current = null;
    latchedRef.current = false;
  }

  const placement =
    stablePlacement ??
    (dockNodeId && pinRef.current?.nodeId === dockNodeId
      ? pinRef.current.placement
      : null);

  const active = Boolean(
    dockNodeId && placement && (stablePlacement || latchedRef.current),
  );

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
