import type { CanvasFlowNode } from "./types";
import { ensureNodeDragHandles } from "./normalize-graph-nodes";
import { pickStoreToRfPosition } from "./canvas-rf-sync-position";
import {
  isPro2StyledGroup,
  syncPro2MediaGroupZIndex,
} from "./pro2-media-group-meta";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";

/** RF 节点列表 · 媒体组 zIndex 与选中态对齐（须写回 useNodesState，勿仅 useMemo 派生） */
export function applyRfNodesMediaGroupZIndex(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return syncPro2MediaGroupZIndex(nodes);
}

function isStyledMediaGroupNode(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): boolean {
  return (
    node.type === "group" &&
    (isPro2StyledGroup(node, allNodes) || isSbv1MediaGroup(node, allNodes))
  );
}

/** 媒体组 zIndex 随 RF 选中态本地计算 · store 合并时勿用陈旧 zIndex 覆盖 */
function mergeZIndexFromStoreToRf(
  rf: CanvasFlowNode,
  sn: CanvasFlowNode,
  storeNodes: CanvasFlowNode[],
): number | undefined {
  if (isStyledMediaGroupNode(sn, storeNodes)) {
    return rf.zIndex ?? sn.zIndex;
  }
  if (sn.parentId) {
    const parent = storeNodes.find((n) => n.id === sn.parentId);
    if (parent && isStyledMediaGroupNode(parent, storeNodes)) {
      return rf.zIndex ?? sn.zIndex;
    }
  }
  return sn.zIndex;
}

/** 仅更新 RF 本地选中（不写 zustand），供 focusCanvasNode / 打组后选中新组 */
export const CANVAS_RF_SELECT_NODE_EVENT = "canvas:rf-select-node";
/** React Flow 已挂载 · 浮动 Dock 可 portal 到 viewport */
export const CANVAS_RF_VIEWPORT_READY_EVENT = "canvas:rf-viewport-ready";

export function dispatchCanvasRfSelectNode(nodeId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CANVAS_RF_SELECT_NODE_EVENT, { detail: { nodeId } }),
  );
}

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
  opts?: { preserveRfSelection?: boolean; preserveRfPositions?: boolean },
): CanvasFlowNode[] {
  const preserveRfSelection = opts?.preserveRfSelection ?? false;
  const preserveRfPositions = opts?.preserveRfPositions ?? false;
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
    const zIndex = mergeZIndexFromStoreToRf(rf, sn, storeNodes);
    if (
      rf.type === sn.type &&
      rf.data === sn.data &&
      rf.selected === selected &&
      rf.position.x === sn.position.x &&
      rf.position.y === sn.position.y &&
      rf.width === sn.width &&
      rf.height === sn.height &&
      rf.zIndex === zIndex &&
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
      position: pickStoreToRfPosition({
        preserveRfPositions,
        rfParentId: rf.parentId,
        storeParentId: sn.parentId,
        rfPosition: rf.position,
        storePosition: sn.position,
      }),
      width: sn.width,
      height: sn.height,
      zIndex,
      parentId: sn.parentId,
      extent: sn.extent,
      style: sn.style,
      dragHandle: sn.dragHandle,
    });
  }

  if (!changed) return rfNodes;
  return next;
}
