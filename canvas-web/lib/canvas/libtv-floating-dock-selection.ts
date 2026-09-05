import type { CanvasFlowNode } from "./types";
import { isGroupNode } from "./types";
import { useMemo } from "react";
import { useNodes } from "@xyflow/react";
import { useCanvasStore } from "./store";
import { useCanvasMarqueeSelecting } from "./use-canvas-marquee-selecting";
import { libtvDetailEditorOpenForNode } from "./libtv-detail-editor-open";

/** LibTV 浮动 Dock · 唯一选中节点（排除 group） */
export function resolveLibtvFloatingDockSelection(
  nodes: { id: string; type?: string; selected?: boolean }[],
): { nodeId: string; nodeType: string } | null {
  let found: { nodeId: string; nodeType: string } | null = null;
  let count = 0;
  for (const n of nodes) {
    if (!n.selected || !n.type || isGroupNode(n.type)) continue;
    count += 1;
    found = { nodeId: n.id, nodeType: n.type };
    if (count > 1) return null;
  }
  return count === 1 ? found : null;
}

export type LibtvFloatingDockPin = {
  nodeId: string | null;
  nodeType: string | null;
};

/**
 * 唯一选中节点的 Dock 目标 id：优先 RF 选中态，store pin 兜底（sync/zoom 时 RF 选中可能闪断）。
 */
export function resolveLibtvSoleSelectedNodeId(
  rfNodes: { id: string; type?: string; selected?: boolean }[],
  nodeType: string,
  pinned: LibtvFloatingDockPin,
  opts?: { marqueeSelecting?: boolean },
): string | null {
  if (opts?.marqueeSelecting) return null;
  if (countLibtvSelectedNonGroupNodes(rfNodes) >= 2) return null;
  if (countLibtvSelectedNonGroupNodes(rfNodes) === 0) return null;

  const rfGlobal = resolveLibtvFloatingDockSelection(rfNodes);
  if (rfGlobal?.nodeType === nodeType) {
    const id = rfGlobal.nodeId;
    if (id && !libtvDetailEditorOpenForNode(id)) return id;
  }

  return null;
}

/** @deprecated use resolveLibtvSoleSelectedNodeId */
export function resolveLibtvFloatingDockSelectionWithPin(
  rfNodes: { id: string; type?: string; selected?: boolean }[],
  pinned: LibtvFloatingDockPin,
): { nodeId: string; nodeType: string } | null {
  const rfGlobal = resolveLibtvFloatingDockSelection(rfNodes);
  if (rfGlobal) return rfGlobal;
  const pinId = pinned.nodeId?.trim() ?? "";
  const pinType = pinned.nodeType?.trim() ?? "";
  if (
    pinId &&
    pinType &&
    rfNodes.some((n) => n.id === pinId) &&
    !libtvDetailEditorOpenForNode(pinId) &&
    countLibtvSelectedNonGroupNodes(rfNodes) <= 1
  ) {
    return { nodeId: pinId, nodeType: pinType };
  }
  return null;
}

/** 当前选中的非 group 节点数（框选 / 多选 ≥2 时不应弹单节点 Dock / 顶栏） */
export function countLibtvSelectedNonGroupNodes(
  nodes: { id: string; type?: string; selected?: boolean }[],
): number {
  let count = 0;
  for (const n of nodes) {
    if (!n.selected || !n.type || isGroupNode(n.type)) continue;
    count += 1;
  }
  return count;
}

/** 框选进行中或多选 ≥2：禁止任何单节点浮动 Dock */
export function useLibtvShouldSuppressFloatingDock(): boolean {
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const multiSelectActive = useCanvasStore((s) => s.canvasMultiSelectActive);
  const rfNodes = useNodes();
  return useMemo(
    () =>
      marqueeSelecting ||
      multiSelectActive ||
      countLibtvSelectedNonGroupNodes(rfNodes) >= 2,
    [marqueeSelecting, multiSelectActive, rfNodes],
  );
}

/** 节点是否为当前唯一选中（框选进行中恒为 false） */
export function useLibtvIsNodeSoleSelected(
  nodeId: string,
  selected: boolean,
): boolean {
  const rfNodes = useNodes();
  const marqueeSelecting = useCanvasMarqueeSelecting();

  return useMemo(() => {
    if (marqueeSelecting) return false;

    if (selected) {
      let count = 0;
      let match = false;
      for (const n of rfNodes) {
        if (!n.selected || !n.type || isGroupNode(n.type)) continue;
        count += 1;
        if (n.id === nodeId) match = true;
        if (count > 1) return false;
      }
      if (count === 1 && match) return true;
    }

    return false;
  }, [marqueeSelecting, selected, nodeId, rfNodes]);
}
