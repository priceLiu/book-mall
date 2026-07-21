import type { NodeChange } from "@xyflow/react";

import type { CanvasFlowNode } from "./types";

/** 将 dimensions 变更同步到 node.width/height 与 style（避免 NodeResizer 松手后尺寸回弹） */
export function syncNodeDimensionsFromChanges(
  nodes: CanvasFlowNode[],
  changes: NodeChange[],
): CanvasFlowNode[] {
  const dimById = new Map<string, { width?: number; height?: number }>();
  for (const ch of changes) {
    if (ch.type !== "dimensions" || !("id" in ch) || !ch.id || !ch.dimensions) {
      continue;
    }
    const prev = dimById.get(ch.id) ?? {};
    const attrs =
      "setAttributes" in ch && ch.setAttributes !== undefined
        ? ch.setAttributes
        : true;
    const patch = { ...prev };
    if (attrs === true || attrs === "width") {
      patch.width = ch.dimensions.width;
    }
    if (attrs === true || attrs === "height") {
      patch.height = ch.dimensions.height;
    }
    dimById.set(ch.id, patch);
  }
  if (dimById.size === 0) return nodes;
  return nodes.map((n) => {
    const dim = dimById.get(n.id);
    if (!dim) return n;
    const style = (typeof n.style === "object" && n.style ? n.style : {}) as {
      width?: number;
      height?: number;
    };
    const width = dim.width ?? n.width ?? style.width;
    const height = dim.height ?? n.height ?? style.height;
    if (width === undefined || height === undefined) return n;
    return {
      ...n,
      width,
      height,
      style: { ...style, width, height },
    } as CanvasFlowNode;
  });
}

/** 纯选中变更（不含坐标/尺寸） */
export function isCanvasSelectionOnlyChange(changes: NodeChange[]): boolean {
  return changes.length > 0 && changes.every((c) => c.type === "select");
}

/** RF 回写选中 / zIndex 与 store 一致时跳过 set，避免 store↔RF 无限循环 */
export function canvasNodesSelectionAndZEqual(
  prev: CanvasFlowNode[],
  next: CanvasFlowNode[],
): boolean {
  if (prev.length !== next.length) return false;
  const nextById = new Map(next.map((n) => [n.id, n]));
  for (const n of prev) {
    const m = nextById.get(n.id);
    if (!m) return false;
    if (Boolean(n.selected) !== Boolean(m.selected)) return false;
    if ((n.zIndex ?? 0) !== (m.zIndex ?? 0)) return false;
  }
  return true;
}

/** 仅 RF 本地处理的变更：选中 / ResizeObserver 纯测量（无 resizing 键）/ 无 dragging 的坐标回写 */
export function isRfLocalNodeChange(c: NodeChange): boolean {
  if (c.type === "select") return true;
  if (c.type === "dimensions" && !("resizing" in c)) return true;
  // RF 在 parentId 变更后会回写相对坐标，通常不带 dragging；用户拖放松手必带 dragging:false
  if (c.type === "position" && !("dragging" in c)) return true;
  return false;
}

/** 剥离不应写 store 的 RF 变更 */
export function filterStoreBoundNodeChanges(
  changes: NodeChange[],
): NodeChange[] {
  return changes.filter((c) => !isRfLocalNodeChange(c));
}

/** 批次是否全部为 RF 本地变更（选中 + 纯测量），无需写 store */
export function isCanvasRfLocalOnlyChange(changes: NodeChange[]): boolean {
  return changes.length > 0 && changes.every(isRfLocalNodeChange);
}

/**
 * RF ResizeObserver 纯测量（`dimensions` 且**不含** `resizing` 键）。
 * 用户 NodeResizer 拖拽的 dimensions 始终带 `resizing`，不在此列。
 */
export function isCanvasInternalDimensionsOnlyChange(
  changes: NodeChange[],
): boolean {
  if (changes.length === 0) return false;
  let hasDimensions = false;
  for (const c of changes) {
    if (c.type === "select") continue;
    if (c.type === "dimensions") {
      if ("resizing" in c) return false;
      hasDimensions = true;
      continue;
    }
    return false;
  }
  return hasDimensions;
}

export function dimensionChangeIds(changes: NodeChange[]): string[] {
  return changes
    .filter(
      (c): c is NodeChange & { type: "dimensions"; id: string } =>
        c.type === "dimensions" && "id" in c && typeof c.id === "string",
    )
    .map((c) => c.id);
}

/** 比较指定节点的坐标与尺寸是否一致 */
export function canvasNodesLayoutFieldsEqual(
  prev: CanvasFlowNode[],
  next: CanvasFlowNode[],
  ids: Iterable<string>,
): boolean {
  const nextById = new Map(next.map((n) => [n.id, n]));
  for (const id of ids) {
    const a = prev.find((n) => n.id === id);
    const b = nextById.get(id);
    if (!a || !b) return false;
    if (a.position.x !== b.position.x || a.position.y !== b.position.y) {
      return false;
    }
    if ((a.width ?? 0) !== (b.width ?? 0) || (a.height ?? 0) !== (b.height ?? 0)) {
      return false;
    }
    if (a.parentId !== b.parentId) return false;
  }
  return true;
}

/** 拖动坐标 / NodeResizer 缩放过程中（尚未 commit） */
export function isCanvasInteractiveGeometryInProgress(
  changes: NodeChange[],
): boolean {
  if (changes.length === 0) return false;
  return changes.every((c) => {
    if (c.type === "position" && "dragging" in c) {
      return c.dragging === true;
    }
    if (c.type === "dimensions" && "resizing" in c) {
      return c.resizing === true;
    }
    return false;
  });
}

/** 仅拖动坐标提交（松手），无需跑 normalize 以免工作区 reflow 覆盖用户坐标 */
export function isCanvasPositionCommitOnly(
  changes: NodeChange[],
): boolean {
  if (changes.length === 0) return false;
  return changes.every((c) => {
    if (c.type === "select") return true;
    if (c.type === "position" && "dragging" in c && c.dragging === false) {
      return true;
    }
    return false;
  });
}

/** 仅拖角缩放提交（松手），无需跑 normalize 以免节点内容重算/闪动 */
export function isCanvasDimensionCommitOnly(
  changes: NodeChange[],
  manualIds: Set<string>,
): boolean {
  if (manualIds.size === 0 || changes.length === 0) return false;
  return changes.every((c) => {
    if (c.type === "select") return true;
    if (
      c.type === "dimensions" &&
      "id" in c &&
      c.id &&
      manualIds.has(c.id) &&
      "resizing" in c &&
      c.resizing === false
    ) {
      return true;
    }
    if (
      c.type === "position" &&
      "id" in c &&
      c.id &&
      manualIds.has(c.id) &&
      "dragging" in c &&
      c.dragging === false
    ) {
      return true;
    }
    return false;
  });
}

/**
 * 左/上缘缩放会改 origin；RF 的 position 回写常被 filter 掉，须与 dimensions 一并落库。
 */
/** NodeResizer 松手（`resizing: false`）的节点 id */
export function extractResizeCommitIds(changes: NodeChange[]): string[] {
  const ids: string[] = [];
  for (const c of changes) {
    if (
      c.type === "dimensions" &&
      "id" in c &&
      c.id &&
      "resizing" in c &&
      c.resizing === false
    ) {
      ids.push(c.id);
    }
  }
  return ids;
}

export function isResizeRelatedChange(
  c: NodeChange,
  resizeIds: Set<string>,
): boolean {
  if (!("id" in c) || !c.id || !resizeIds.has(c.id)) return false;
  return c.type === "dimensions" || c.type === "position";
}

/** 从 RF 当前帧读取 position + width + height（左/上缘缩放须一并落库） */
export function buildGeometryPatchesFromRf(
  ids: string[],
  rfNodes: CanvasFlowNode[],
): Array<{
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
}> {
  return ids.flatMap((id) => {
    const n = rfNodes.find((x) => x.id === id);
    if (!n) return [];
    const style = n.style as { width?: number; height?: number } | undefined;
    const width = Number(n.width ?? style?.width ?? n.measured?.width);
    const height = Number(n.height ?? style?.height ?? n.measured?.height);
    if (!width || !height) return [];
    return [
      {
        id,
        position: { x: n.position.x, y: n.position.y },
        width,
        height,
      },
    ];
  });
}

/** 组框缩放中（`resizing: true`） */
export function findGroupResizeInProgress(
  changes: NodeChange[],
  rfNodes: Array<{ id: string; type?: string }>,
): string | null {
  for (const c of changes) {
    if (
      c.type === "dimensions" &&
      "id" in c &&
      c.id &&
      "resizing" in c &&
      c.resizing === true
    ) {
      const n = rfNodes.find((x) => x.id === c.id);
      if (n?.type === "group") return c.id;
    }
  }
  return null;
}

export const GROUP_RESIZE_MIN_WIDTH = 220;
export const GROUP_RESIZE_MIN_HEIGHT = 140;

export function isGroupResizeTooSmall(
  width: number,
  height: number,
  contentMin?: { minWidth: number; minHeight: number },
): boolean {
  if (width < GROUP_RESIZE_MIN_WIDTH || height < GROUP_RESIZE_MIN_HEIGHT) {
    return true;
  }
  if (!contentMin) return false;
  return width < contentMin.minWidth || height < contentMin.minHeight;
}

export type GroupResizeSnapshot = {
  position: { x: number; y: number };
  width: number;
  height: number;
};

export function readGroupResizeGeometry(
  group: CanvasFlowNode,
): GroupResizeSnapshot | null {
  const style = group.style as { width?: number; height?: number } | undefined;
  const width = Number(
    group.width ?? style?.width ?? group.measured?.width ?? 0,
  );
  const height = Number(
    group.height ?? style?.height ?? group.measured?.height ?? 0,
  );
  if (!width || !height) return null;
  return {
    position: { x: group.position.x, y: group.position.y },
    width,
    height,
  };
}

export type GroupResizeFrozenAbs = Map<string, { x: number; y: number }>;

/** 缩放开始时冻结子节点屏幕绝对坐标 */
export function buildGroupResizeFrozenAbs(
  groupId: string,
  rfNodes: Array<{
    id: string;
    parentId?: string;
    position: { x: number; y: number };
  }>,
): GroupResizeFrozenAbs {
  const group = rfNodes.find((n) => n.id === groupId);
  if (!group) return new Map();
  const frozen: GroupResizeFrozenAbs = new Map();
  for (const n of rfNodes) {
    if (n.parentId !== groupId) continue;
    frozen.set(n.id, {
      x: group.position.x + n.position.x,
      y: group.position.y + n.position.y,
    });
  }
  return frozen;
}

export function augmentStoreChangesWithResizePositions(
  changes: NodeChange[],
  rfNodes: Array<{ id: string; position: { x: number; y: number } }>,
): NodeChange[] {
  const resizeIds = new Set<string>();
  for (const c of changes) {
    if (
      c.type === "dimensions" &&
      "id" in c &&
      c.id &&
      "resizing" in c &&
      c.resizing === false
    ) {
      resizeIds.add(c.id);
    }
  }
  if (!resizeIds.size) return changes;

  const out = [...changes];
  for (const id of resizeIds) {
    const hasPosCommit = changes.some(
      (c) =>
        c.type === "position" &&
        "id" in c &&
        c.id === id &&
        "dragging" in c &&
        c.dragging === false,
    );
    if (hasPosCommit) continue;
    const rf = rfNodes.find((n) => n.id === id);
    if (!rf) continue;
    out.push({
      id,
      type: "position",
      position: rf.position,
      dragging: false,
    });
  }
  return out;
}
