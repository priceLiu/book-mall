import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** RF/CSS · 操纵中的组壳（低于组内子节点，高于其它组/连线默认层） */
export const CANVAS_Z_GROUP_MANIPULATION = 1200;
/** 操纵中的组内子节点 / 独立选中节点 */
export const CANVAS_Z_CHILD_MANIPULATION = 1201;
/** 操纵 bundle 内连线 · 高于默认 12、低于子节点 1201 */
export const CANVAS_EDGE_Z_MANIPULATION = 1199;
/** 当前拖动中的节点 · 须高于组内子节点 1201（RF 排序 groups→roots→children 会压后绘制） */
export const CANVAS_Z_DRAGGED_TOP = 1202;

export const LIBTV_MANIPULATION_ACTIVE_CLASS = "libtv-manipulation-active";
export const LIBTV_MANIPULATION_DRAG_TOP_CLASS = "libtv-manipulation-drag-top";

const CANVAS_Z_GROUP_BASE = 5;
const CANVAS_Z_CHILD_BASE = 22;

export type LibtvManipulationLayerOptions = {
  /** store 登记的拖动 id（RF 帧上可能尚无 dragging 标志） */
  draggingNodeIds?: Iterable<string> | null;
  /** 拖入分组悬停中的目标组 · 与整组操纵层一并抬升，避免拖入过程穿插 */
  hoverGroupIds?: Iterable<string> | null;
};

function draggingIdSet(
  options?: LibtvManipulationLayerOptions,
): Set<string> | null {
  if (!options?.draggingNodeIds) return null;
  return new Set(options.draggingNodeIds);
}

function isManipulationSeed(
  n: CanvasFlowNode,
  dragIds: Set<string> | null,
): boolean {
  if (n.selected) return true;
  if (dragIds?.has(n.id)) return true;
  return Boolean((n as { dragging?: boolean }).dragging);
}

function isStyledMediaGroupNode(
  n: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): boolean {
  return (
    n.type === "group" &&
    (isPro2StyledGroup(n, nodes) || isSbv1MediaGroup(n, nodes))
  );
}

function patchManipulationClassName(
  existing: string | undefined,
  active: boolean,
  dragTop = false,
): string | undefined {
  const base = (existing ?? "")
    .replace(/\blibtv-manipulation-active\b/g, "")
    .replace(/\blibtv-manipulation-drag-top\b/g, "")
    .replace(/\bis-drop-target\b/g, "")
    .trim();
  const parts: string[] = [];
  if (active) parts.push(LIBTV_MANIPULATION_ACTIVE_CLASS);
  if (dragTop) parts.push(LIBTV_MANIPULATION_DRAG_TOP_CLASS);
  if (!parts.length) return base || undefined;
  return base ? `${base} ${parts.join(" ")}` : parts.join(" ");
}

/** 拖动节点排到 RF 数组末尾 · 与 zIndex 1202 互补（组节点不可单独置后，须保持父在子前） */
export function sortLibtvNodesWithDraggingLast(
  nodes: CanvasFlowNode[],
  draggingNodeIds?: Iterable<string> | null,
): CanvasFlowNode[] {
  if (!draggingNodeIds) return nodes;
  const ids = [...draggingNodeIds].filter(Boolean);
  if (!ids.length) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (ids.some((id) => byId.get(id)?.type === "group")) {
    return nodes;
  }
  const idSet = new Set(ids);
  const dragged: CanvasFlowNode[] = [];
  const rest: CanvasFlowNode[] = [];
  for (const n of nodes) {
    if (idSet.has(n.id)) dragged.push(n);
    else rest.push(n);
  }
  if (!dragged.length) return nodes;
  return [...rest, ...dragged];
}

function addHoverGroupIds(
  active: Set<string>,
  options?: LibtvManipulationLayerOptions,
): void {
  if (!options?.hoverGroupIds) return;
  for (const id of options.hoverGroupIds) {
    if (id) active.add(id);
  }
}

/** 任一子节点 / 组壳选中或拖动时，整组进入同一操纵层 */
export function resolveActiveManipulationGroupIds(
  nodes: CanvasFlowNode[],
  options?: LibtvManipulationLayerOptions,
): Set<string> {
  const dragIds = draggingIdSet(options);
  const active = new Set<string>();
  for (const n of nodes) {
    if (n.type === "group" && isManipulationSeed(n, dragIds)) {
      active.add(n.id);
    }
  }
  for (const n of nodes) {
    if (n.type === "group") continue;
    if (isManipulationSeed(n, dragIds) && n.parentId) {
      active.add(n.parentId);
    }
  }
  addHoverGroupIds(active, options);
  return active;
}

export function nodeInManipulationBundle(
  n: CanvasFlowNode | undefined,
  activeGroupIds: Set<string>,
  dragIds: Set<string> | null,
): boolean {
  if (!n) return false;
  if (n.type === "group" && activeGroupIds.has(n.id)) return true;
  if (n.parentId && activeGroupIds.has(n.parentId)) return true;
  if (!n.parentId && isManipulationSeed(n, dragIds)) return true;
  return false;
}

export function edgeInManipulationBundle(
  edge: Pick<CanvasFlowEdge, "source" | "target">,
  nodes: CanvasFlowNode[],
  options?: LibtvManipulationLayerOptions,
): boolean {
  const dragIds = draggingIdSet(options);
  const activeGroupIds = resolveActiveManipulationGroupIds(nodes, options);
  if (!activeGroupIds.size && !dragIds?.size) return false;
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);
  return (
    nodeInManipulationBundle(src, activeGroupIds, dragIds) ||
    nodeInManipulationBundle(tgt, activeGroupIds, dragIds)
  );
}

/** 选中 ≡ 拖动：整组壳 + 全部 sibling 子节点同步 zIndex / class */
export function applyLibtvManipulationLayerToNodes(
  nodes: CanvasFlowNode[],
  options?: LibtvManipulationLayerOptions,
): CanvasFlowNode[] {
  const dragIds = draggingIdSet(options);
  const activeGroupIds = resolveActiveManipulationGroupIds(nodes, options);
  const styledGroupIds = new Set(
    nodes.filter((n) => isStyledMediaGroupNode(n, nodes)).map((n) => n.id),
  );

  let changed = false;
  const next = nodes.map((n) => {
    const rfClass = (n as { className?: string }).className;
    if (dragIds?.has(n.id)) {
      const isGroupShell = n.type === "group";
      const z = isGroupShell
        ? CANVAS_Z_GROUP_MANIPULATION
        : CANVAS_Z_DRAGGED_TOP;
      const className = patchManipulationClassName(
        rfClass,
        true,
        !isGroupShell,
      );
      if (n.zIndex === z && rfClass === className) {
        return n;
      }
      changed = true;
      return {
        ...n,
        zIndex: z,
        className,
      };
    }

    const inActiveBundle =
      (n.type === "group" && activeGroupIds.has(n.id)) ||
      (n.parentId != null && activeGroupIds.has(n.parentId));

    if (inActiveBundle) {
      const z =
        n.type === "group"
          ? CANVAS_Z_GROUP_MANIPULATION
          : CANVAS_Z_CHILD_MANIPULATION;
      const className = patchManipulationClassName(rfClass, true);
      if (n.zIndex === z && rfClass === className) return n;
      changed = true;
      return { ...n, zIndex: z, className };
    }

    if (n.type === "group" && styledGroupIds.has(n.id)) {
      const className = patchManipulationClassName(rfClass, false);
      if (n.zIndex === CANVAS_Z_GROUP_BASE && rfClass === className) return n;
      changed = true;
      return {
        ...n,
        zIndex: CANVAS_Z_GROUP_BASE,
        className,
      };
    }
    if (n.parentId && styledGroupIds.has(n.parentId)) {
      const className = patchManipulationClassName(rfClass, false);
      if (n.zIndex === CANVAS_Z_CHILD_BASE && rfClass === className) return n;
      changed = true;
      return {
        ...n,
        zIndex: CANVAS_Z_CHILD_BASE,
        className,
      };
    }

    const className = patchManipulationClassName(rfClass, false);
    const stuckManipZ =
      n.zIndex === CANVAS_Z_GROUP_MANIPULATION ||
      n.zIndex === CANVAS_Z_CHILD_MANIPULATION ||
      n.zIndex === CANVAS_Z_DRAGGED_TOP;
    if (rfClass !== className || stuckManipZ) {
      changed = true;
      const { zIndex: _drop, ...rest } = n;
      return { ...rest, className };
    }
    return n;
  });
  return changed ? next : nodes;
}

/** @deprecated 别名 · 仍供 store 路径引用 */
export function syncPro2MediaGroupZIndex(
  nodes: CanvasFlowNode[],
  options?: LibtvManipulationLayerOptions,
): CanvasFlowNode[] {
  return applyLibtvManipulationLayerToNodes(nodes, options);
}
