import type { CanvasFlowNode } from "./types";
import { pro2NodeAbsolutePosition } from "./pro2-selection-bbox";

export type LibtvUserSelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** RF `transform` = [translateX, translateY, zoom]；框选矩形是 pane 像素 */
export function userSelectionToFlowRect(
  rect: LibtvUserSelectionRect,
  transform: [number, number, number],
): { x: number; y: number; w: number; h: number } {
  const [tx, ty, zoom] = transform;
  const z = zoom || 1;
  return {
    x: (rect.x - tx) / z,
    y: (rect.y - ty) / z,
    w: rect.width / z,
    h: rect.height / z,
  };
}

/**
 * 框选命中框：只用用户节点 width/height + parent 链绝对坐标。
 * 不读 RF internals.measured / handleBounds（组移动/拉伸后这两项会脏）。
 */
export function libtvMarqueeNodeBox(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): { x: number; y: number; w: number; h: number } | null {
  const style = node.style as { width?: number; height?: number } | undefined;
  const w =
    (typeof node.width === "number" && node.width > 0
      ? node.width
      : undefined) ??
    (typeof style?.width === "number" && style.width > 0
      ? style.width
      : undefined);
  const h =
    (typeof node.height === "number" && node.height > 0
      ? node.height
      : undefined) ??
    (typeof style?.height === "number" && style.height > 0
      ? style.height
      : undefined);
  if (typeof w !== "number" || typeof h !== "number") return null;
  const pos = pro2NodeAbsolutePosition(node, allNodes);
  return { x: pos.x, y: pos.y, w, h };
}

function boxFullyInside(
  box: { x: number; y: number; w: number; h: number },
  rect: { x: number; y: number; w: number; h: number },
  epsilon = 0.5,
): boolean {
  return (
    box.x >= rect.x - epsilon &&
    box.y >= rect.y - epsilon &&
    box.x + box.w <= rect.x + rect.w + epsilon &&
    box.y + box.h <= rect.y + rect.h + epsilon
  );
}

/** SelectionMode.Full：节点外框必须完全落在框选矩形内 */
export function collectLibtvMarqueeNodeIds(
  nodes: CanvasFlowNode[],
  userSelectionRect: LibtvUserSelectionRect,
  transform: [number, number, number],
): Set<string> {
  const hits = new Set<string>();
  if (userSelectionRect.width <= 1 && userSelectionRect.height <= 1) {
    return hits;
  }
  const rect = userSelectionToFlowRect(userSelectionRect, transform);
  if (rect.w <= 1 && rect.h <= 1) return hits;

  for (const node of nodes) {
    if (node.hidden) continue;
    if (node.selectable === false) continue;
    const box = libtvMarqueeNodeBox(node, nodes);
    if (!box) continue;
    if (boxFullyInside(box, rect)) hits.add(node.id);
  }
  return hits;
}

export function applyLibtvMarqueeSelection<
  N extends { id: string; selected?: boolean },
>(nodes: N[], hitIds: Set<string>): N[] {
  let changed = false;
  const next = nodes.map((n) => {
    const selected = hitIds.has(n.id);
    if (Boolean(n.selected) === selected) return n;
    changed = true;
    return { ...n, selected };
  });
  return changed ? next : nodes;
}

/** 多选虚线框：只用用户 width/height + parent 链，不读 internals / DOMRect（拖动中这两项会慢一帧，造成拖影）。 */
export function libtvSelectionFlowBox(
  nodes: CanvasFlowNode[],
  selectedIds?: Iterable<string>,
): { x: number; y: number; w: number; h: number } | null {
  const idSet = selectedIds ? new Set(selectedIds) : null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;
  for (const node of nodes) {
    if (idSet ? !idSet.has(node.id) : !node.selected) continue;
    if (node.hidden) continue;
    const box = libtvMarqueeNodeBox(node, nodes);
    if (!box) continue;
    count += 1;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  if (count < 2) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * 多选整组拖动：父组已选中时不重复平移子节点（与 RF getDragItems 一致）。
 */
export function applySelectionDragDelta<
  N extends {
    id: string;
    selected?: boolean;
    parentId?: string;
    type?: string;
    position: { x: number; y: number };
  },
>(nodes: N[], dx: number, dy: number): N[] {
  if (dx === 0 && dy === 0) return nodes;
  const selectedIds = new Set(
    nodes.filter((n) => n.selected).map((n) => n.id),
  );
  let changed = false;
  const next = nodes.map((n) => {
    if (!n.selected) return n;
    if (n.parentId && selectedIds.has(n.parentId)) return n;
    changed = true;
    return {
      ...n,
      position: { x: n.position.x + dx, y: n.position.y + dy },
    };
  });
  return changed ? next : nodes;
}
