import type { CanvasFlowNode } from "./types";
import { isGroupNode } from "./types";
import { useCanvasMarqueeSelecting } from "./use-canvas-marquee-selecting";
import { useMemo } from "react";
import { useNodes } from "@xyflow/react";

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

/** 节点是否为当前唯一选中（框选进行中恒为 false） */
export function useLibtvIsNodeSoleSelected(
  nodeId: string,
  selected: boolean,
): boolean {
  const rfNodes = useNodes();
  const marqueeSelecting = useCanvasMarqueeSelecting();
  return useMemo(() => {
    if (marqueeSelecting || !selected) return false;
    let count = 0;
    let match = false;
    for (const n of rfNodes) {
      if (!n.selected || !n.type || isGroupNode(n.type)) continue;
      count += 1;
      if (n.id === nodeId) match = true;
      if (count > 1) return false;
    }
    return count === 1 && match;
  }, [marqueeSelecting, selected, nodeId, rfNodes]);
}
