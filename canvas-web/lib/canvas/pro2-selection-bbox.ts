import type { CanvasFlowNode } from "./types";
import { isGroupNode } from "./types";

/** 节点在画布上的绝对坐标（含 parent 链） */
export function pro2NodeAbsolutePosition(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = allNodes.find((n) => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

export function pro2NodeBoxSize(node: CanvasFlowNode): { w: number; h: number } {
  const style = node.style as { width?: number; height?: number } | undefined;
  const w =
    (typeof node.width === "number" ? node.width : undefined) ??
    node.measured?.width ??
    style?.width ??
    240;
  const h =
    (typeof node.height === "number" ? node.height : undefined) ??
    node.measured?.height ??
    style?.height ??
    200;
  return { w, h };
}

export type Pro2SelectionBbox = {
  x: number;
  y: number;
  x2: number;
  y2: number;
};

/** 框选工具条定位：优先 internal-node，回退 rf/store 节点数据 */
export function computePro2MultiSelectionBbox(
  selectedIds: string[],
  allNodes: CanvasFlowNode[],
  getInternalNode: (id: string) => unknown,
): Pro2SelectionBbox | null {
  if (selectedIds.length < 2) return null;
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (const id of selectedIds) {
    const node = allNodes.find((n) => n.id === id);
    if (!node) continue;

    const internal = getInternalNode(id) as
      | {
          measured?: { width?: number; height?: number };
          position: { x: number; y: number };
          internals?: { positionAbsolute?: { x: number; y: number } };
          width?: number;
          height?: number;
        }
      | undefined;

    if (internal) {
      const w =
        internal.measured?.width ??
        (typeof internal.width === "number" ? internal.width : undefined) ??
        pro2NodeBoxSize(node).w;
      const h =
        internal.measured?.height ??
        (typeof internal.height === "number" ? internal.height : undefined) ??
        pro2NodeBoxSize(node).h;
      const pos =
        internal.internals?.positionAbsolute ??
        internal.position ??
        pro2NodeAbsolutePosition(node, allNodes);
      boxes.push({ x: pos.x, y: pos.y, w, h });
      continue;
    }

    const { w, h } = pro2NodeBoxSize(node);
    const pos = pro2NodeAbsolutePosition(node, allNodes);
    boxes.push({ x: pos.x, y: pos.y, w, h });
  }

  if (boxes.length === 0) return null;
  return {
    x: Math.min(...boxes.map((b) => b.x)),
    y: Math.min(...boxes.map((b) => b.y)),
    x2: Math.max(...boxes.map((b) => b.x + b.w)),
    y2: Math.max(...boxes.map((b) => b.y + b.h)),
  };
}

export function pro2SelectedNonGroupIds(allNodes: CanvasFlowNode[]): string[] {
  return allNodes
    .filter((n) => n.selected && !isGroupNode(n.type as string))
    .map((n) => n.id);
}
