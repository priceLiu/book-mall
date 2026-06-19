import type { CanvasFlowNode } from "./types";
import { ensureNodeDragHandles } from "./normalize-graph-nodes";

function applyRfSelectionPreserved(
  nodes: CanvasFlowNode[],
  rfNodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const rfSelected = new Set(
    rfNodes.filter((n) => n.selected).map((n) => n.id),
  );
  return nodes.map((n) => ({ ...n, selected: rfSelected.has(n.id) }));
}

/** zustand → RF：未变化节点保留原引用，减轻 memo 失效 */
export function mergeStoreNodesIntoRf(
  rfNodes: CanvasFlowNode[],
  storeNodes: CanvasFlowNode[],
  opts?: { preserveRfSelection?: boolean },
): CanvasFlowNode[] {
  const preserveRfSelection = opts?.preserveRfSelection ?? false;
  if (rfNodes.length !== storeNodes.length) {
    const next = ensureNodeDragHandles(storeNodes);
    return preserveRfSelection
      ? applyRfSelectionPreserved(next, rfNodes)
      : next;
  }

  const storeById = new Map(storeNodes.map((n) => [n.id, n]));
  let changed = false;
  const next: CanvasFlowNode[] = [];

  for (const rf of rfNodes) {
    const sn = storeById.get(rf.id);
    if (!sn) {
      const rebuilt = ensureNodeDragHandles(storeNodes);
      return preserveRfSelection
        ? applyRfSelectionPreserved(rebuilt, rfNodes)
        : rebuilt;
    }
    const selected = preserveRfSelection ? rf.selected : sn.selected;
    if (
      rf.type === sn.type &&
      rf.data === sn.data &&
      rf.selected === selected &&
      rf.position.x === sn.position.x &&
      rf.position.y === sn.position.y &&
      rf.width === sn.width &&
      rf.height === sn.height &&
      rf.zIndex === sn.zIndex &&
      rf.parentId === sn.parentId
    ) {
      next.push(rf);
      continue;
    }
    changed = true;
    next.push({
      ...rf,
      type: sn.type,
      data: sn.data,
      selected,
      position: sn.position,
      width: sn.width,
      height: sn.height,
      zIndex: sn.zIndex,
      parentId: sn.parentId,
      style: sn.style,
      dragHandle: sn.dragHandle,
    });
  }

  if (!changed) return rfNodes;
  return next;
}
