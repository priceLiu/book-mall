import { applyNodeChanges, type NodeChange } from "@xyflow/react";

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
      measured: { width, height },
      style: { ...style, width, height },
    } as CanvasFlowNode;
  });
}

/** 纯选中变更（不含坐标/尺寸） */
export function isCanvasSelectionOnlyChange(changes: NodeChange[]): boolean {
  return changes.length > 0 && changes.every((c) => c.type === "select");
}

/**
 * LibTV · RF 纯测量 echo（`dimensions` 且**不含** `resizing` 键）回写本地 RF 节点。
 *
 * 背景：LibTV 主管线会丢弃这类 echo（避免 ResizeObserver 与 store 互写 width/height），
 * 导致用户节点永远没有 `measured`。此后任何节点对象克隆（选中、拖动帧、组缩放 commit…）
 * 都会让 `adoptUserNodes` 重建内部节点时丢掉 `handleBounds`/`measured`，
 * RF 框选 `getNodesInside` 会把这些节点当作「未测量」**无条件选中**（粘连/范围过大/失效）。
 *
 * 这里以 `setAttributes: false` 语义仅回写 `measured`（不动 width/height/style、不写 store），
 * 让后续所有对象克隆都能保住框选所需的内部字段。
 */
export function applyLibtvRfMeasurementEchoes<
  N extends { id: string; measured?: { width?: number; height?: number } },
>(nodes: N[], changes: NodeChange[]): N[] {
  const echoes: Array<{ id: string; width: number; height: number }> = [];
  for (const c of changes) {
    if (c.type !== "dimensions" || !("id" in c) || typeof c.id !== "string") {
      continue;
    }
    if ("resizing" in c) continue; // 用户缩放帧走主管线
    const w = c.dimensions?.width;
    const h = c.dimensions?.height;
    if (typeof w !== "number" || typeof h !== "number" || w <= 0 || h <= 0) {
      continue;
    }
    echoes.push({ id: c.id, width: w, height: h });
  }
  if (echoes.length === 0) return nodes;

  let next: N[] | null = null;
  for (const echo of echoes) {
    const idx = (next ?? nodes).findIndex((n) => n.id === echo.id);
    if (idx < 0) continue;
    const node = (next ?? nodes)[idx]!;
    // 显式外框节点由 alignRfNodesMeasuredToBox 统一 measured；RO echo 常为 stage 内尺寸，与 width/height 打架 → 拖动死循环
    if (readNodeBoxSize(node)) continue;
    const m = node.measured;
    if (m?.width === echo.width && m?.height === echo.height) continue;
    if (!next) next = [...nodes];
    // 仅写 measured；绝不写 width/height/style（setAttributes:false 语义）
    next[idx] = {
      ...node,
      measured: { width: echo.width, height: echo.height },
    };
  }
  return next ?? nodes;
}

function readNodeBoxSize(node: {
  width?: number;
  height?: number;
  style?: unknown;
}): { width: number; height: number } | null {
  const style =
    typeof node.style === "object" && node.style
      ? (node.style as { width?: number; height?: number })
      : undefined;
  const width =
    typeof node.width === "number" && node.width > 0
      ? node.width
      : typeof style?.width === "number" && style.width > 0
        ? style.width
        : undefined;
  const height =
    typeof node.height === "number" && node.height > 0
      ? node.height
      : typeof style?.height === "number" && style.height > 0
        ? style.height
        : undefined;
  if (typeof width !== "number" || typeof height !== "number") return null;
  return { width, height };
}

/**
 * 显式 width/height 必须盖过陈旧 `measured`。
 * RF 框选 `getNodesInside` 优先用 `measured`；组拉伸后若仍留着旧大框，
 * 就会「范围过大 / 粘连」。无显式尺寸的节点保留 RO `measured`。
 */
export function alignRfNodesMeasuredToBox<
  N extends {
    width?: number;
    height?: number;
    style?: unknown;
    measured?: { width?: number; height?: number };
  },
>(nodes: N[]): N[] {
  let next: N[] | null = null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const box = readNodeBoxSize(node);
    if (!box) continue;
    if (node.measured?.width === box.width && node.measured?.height === box.height) {
      continue;
    }
    if (!next) next = [...nodes];
    next[i] = { ...node, measured: { width: box.width, height: box.height } };
  }
  return next ?? nodes;
}

export function extractSelectNodeChanges(
  changes: NodeChange<CanvasFlowNode>[],
): NodeChange<CanvasFlowNode>[] {
  return changes.filter((c) => c.type === "select");
}

/** LibTV · store 仅 selected/zIndex 漂移时跳过 store→RF merge */
export function canvasNodesEqualIgnoringSelectionAndZ(
  prev: CanvasFlowNode[],
  next: CanvasFlowNode[],
): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]!;
    const b = next[i]!;
    if (a.id !== b.id || a.parentId !== b.parentId || a.type !== b.type) {
      return false;
    }
    if (
      a.data !== b.data &&
      JSON.stringify(a.data) !== JSON.stringify(b.data)
    ) {
      return false;
    }
    if (a.position.x !== b.position.x || a.position.y !== b.position.y) {
      return false;
    }
    if ((a.width ?? 0) !== (b.width ?? 0) || (a.height ?? 0) !== (b.height ?? 0)) {
      return false;
    }
  }
  return true;
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

/** 批次是否含节点删除（须落库，不可因 store→RF 同步 guard 跳过） */
export function hasNodeRemoveChanges(changes: NodeChange[]): boolean {
  return changes.some(
    (c) => c.type === "remove" && "id" in c && typeof c.id === "string",
  );
}

export function extractNodeRemoveChanges(
  changes: NodeChange[],
): Array<NodeChange & { type: "remove"; id: string }> {
  return changes.filter(
    (c): c is NodeChange & { type: "remove"; id: string } =>
      c.type === "remove" && "id" in c && typeof c.id === "string",
  );
}

/** 批次是否全部为 RF 本地变更（选中 + 纯测量），无需写 store */
export function isCanvasRfLocalOnlyChange(changes: NodeChange[]): boolean {
  return changes.length > 0 && changes.every(isRfLocalNodeChange);
}

/**
 * LibTV 画布 · 忽略 RF 内部 echo（ResizeObserver 尺寸 / 组内选中相对坐标）。
 * 仅保留用户真实缩放（resizing 键）与组框缩放 commit 帧。
 */
export function filterLibtvRfChangesBeforeApply<T extends NodeChange>(
  changes: T[],
  opts: {
    groupResizeUserActive: boolean;
    isGroupResizeCommit: boolean;
    activeGroupResizeId?: string | null;
    resizeCommitIds?: string[];
  },
): T[] {
  const resizeCommitIds = new Set(opts.resizeCommitIds ?? []);
  const groupResizingInBatch = new Set(
    changes
      .filter(
        (c) =>
          c.type === "dimensions" &&
          "resizing" in c &&
          c.resizing === true &&
          "id" in c &&
          typeof c.id === "string",
      )
      .map((c) => (c as { id: string }).id),
  );
  return changes.filter((c) => {
    // 坐标落库走 onNodeDragStop · 组内选中常混 position dragging:false echo
    if (c.type === "position") {
      if (
        "id" in c &&
        typeof c.id === "string" &&
        ((opts.groupResizeUserActive &&
          opts.activeGroupResizeId &&
          c.id === opts.activeGroupResizeId) ||
          groupResizingInBatch.has(c.id))
      ) {
        return true;
      }
      return "dragging" in c && c.dragging === true;
    }
    if (c.type !== "dimensions") return true;
    if ("resizing" in c && c.resizing === true) return true;
    if (
      "resizing" in c &&
      c.resizing === false &&
      "id" in c &&
      c.id &&
      resizeCommitIds.has(c.id)
    ) {
      return true;
    }
    if (
      opts.groupResizeUserActive &&
      opts.isGroupResizeCommit &&
      "resizing" in c &&
      c.resizing === false
    ) {
      return true;
    }
    return false;
  });
}

/** select 变更是否会改变 RF 当前选中态（避免 onNodeClick 与 RF 重复 setNodes） */
export function selectChangesWouldChangeSelection(
  changes: NodeChange[],
  rfNodes: Array<{ id: string; selected?: boolean }>,
): boolean {
  for (const c of changes) {
    if (c.type !== "select" || !("id" in c) || !c.id) continue;
    const n = rfNodes.find((x) => x.id === c.id);
    if (!n) continue;
    if (Boolean(n.selected) !== Boolean(c.selected)) return true;
  }
  return false;
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
    const aManual = Boolean((a.data as { manualSize?: boolean }).manualSize);
    const bManual = Boolean((b.data as { manualSize?: boolean }).manualSize);
    if (aManual !== bManual) return false;
  }
  return true;
}

/** 拖动坐标 / NodeResizer 缩放过程中（尚未 commit） */
export function isCanvasInteractiveGeometryInProgress(
  changes: NodeChange[],
): boolean {
  if (changes.length === 0) return false;
  // 拖动帧常混有 RF 纯测量 dimensions（无 resizing）· 须先剥离本地 echo
  const bound = filterStoreBoundNodeChanges(changes);
  if (bound.length === 0) return false;
  return bound.every((c) => {
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

/** 非组框 NodeResizer：`resizing: true` 时记入 session，松手后由 resolveActiveResizeCommitIds 落库 */
export function trackNonGroupNodeResizeSession(
  changes: NodeChange[],
  rfNodes: Array<{ id: string; type?: string }>,
  session: Set<string>,
): void {
  for (const c of changes) {
    if (
      c.type === "dimensions" &&
      "id" in c &&
      c.id &&
      "resizing" in c &&
      c.resizing === true
    ) {
      const n = rfNodes.find((x) => x.id === c.id);
      if (n?.type !== "group") {
        session.add(c.id);
      }
    }
  }
}

/** 组框缩放须 group session；普通节点须 node resize session */
export function resolveActiveResizeCommitIds(
  changes: NodeChange[],
  rfNodes: Array<{ id: string; type?: string }>,
  opts: {
    groupResizeUserActive: boolean;
    nodeResizeSession: Set<string>;
  },
): string[] {
  return extractResizeCommitIds(changes).filter((id) => {
    const n = rfNodes.find((x) => x.id === id);
    if (n?.type === "group") {
      return opts.groupResizeUserActive;
    }
    return opts.nodeResizeSession.has(id);
  });
}

/** store 同步时过滤未激活 session 的 dimensions 松手帧，避免 ResizeObserver echo 落库 */
export function shouldFilterDimensionResizeCommit(
  c: NodeChange,
  activeResizeCommitIds: Set<string>,
): boolean {
  return (
    c.type === "dimensions" &&
    "resizing" in c &&
    c.resizing === false &&
    "id" in c &&
    typeof c.id === "string" &&
    !activeResizeCommitIds.has(c.id)
  );
}

/**
 * LibTV 组框缩放松手：仅认 RF 明确发出的 `resizing: false`。
 * 末帧仅有 dimensions、无 resizing 键时由 pointerup 兜底提交（见 flow-canvas）。
 */
export function isGroupResizeCommitFrame(
  _changes: NodeChange[],
  activeGroupResizeId: string | null,
  resizeCommitIds: string[],
): boolean {
  if (!activeGroupResizeId) return false;
  return resizeCommitIds.includes(activeGroupResizeId);
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

/**
 * 组框缩放 session · 仅认 `resizing: true`。
 * 勿把 ResizeObserver 纯测量（无 resizing 键）当成缩放，否则会误开 session、
 * pointerup 误 commit + flush-autosave，导致「一直保存中」与拖动闪烁。
 */
export function findGroupResizeSessionId(
  changes: NodeChange[],
  rfNodes: Array<{ id: string; type?: string }>,
): string | null {
  return findGroupResizeInProgress(changes, rfNodes);
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

export function parseGroupResizeGeometryFromChanges(
  rfChanges: NodeChange[],
  groupId: string,
  fallback: CanvasFlowNode,
): { position: { x: number; y: number }; width: number; height: number } {
  const style = fallback.style as { width?: number; height?: number } | undefined;
  let position = fallback.position;
  let width = Number(fallback.width ?? style?.width ?? 0);
  let height = Number(fallback.height ?? style?.height ?? 0);
  for (const c of rfChanges) {
    if (!("id" in c) || c.id !== groupId) continue;
    if (c.type === "position" && c.position) {
      position = c.position;
    }
    if (c.type === "dimensions" && c.dimensions) {
      if (c.dimensions.width != null) width = c.dimensions.width;
      if (c.dimensions.height != null) height = c.dimensions.height;
    }
  }
  return { position, width, height };
}

/**
 * LibTV 组框缩放单帧：只应用组框变更，子节点保持 parentId + 高 z-index，
 * 相对坐标钉回冻结绝对坐标（extent 暂解除，避免组框小于内容时被 RF 裁切隐藏）。
 */
export type GroupCornerId = "nw" | "ne" | "sw" | "se";

export type GroupCornerResizeBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** LibTV 组框 · 拖角缩放几何（固定对边锚点，左/上缘同步改 origin） */
export function computeGroupCornerResize(
  corner: GroupCornerId,
  start: GroupCornerResizeBox,
  pointer: { x: number; y: number },
  minWidth: number,
  minHeight: number,
): GroupCornerResizeBox {
  const east = corner === "ne" || corner === "se";
  const south = corner === "sw" || corner === "se";
  const north = corner === "nw" || corner === "ne";
  const west = corner === "nw" || corner === "sw";

  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;

  if (east) {
    w = Math.max(minWidth, pointer.x - start.x);
  }
  if (west) {
    const right = start.x + start.w;
    const nextX = Math.min(pointer.x, right - minWidth);
    w = right - nextX;
    x = nextX;
  }
  if (south) {
    h = Math.max(minHeight, pointer.y - start.y);
  }
  if (north) {
    const bottom = start.y + start.h;
    const nextY = Math.min(pointer.y, bottom - minHeight);
    h = bottom - nextY;
    y = nextY;
  }

  return { x, y, w, h };
}

/** 组框缩放单帧 · 仅保留组节点 dimensions/position（左/上缘缩放须同步 position） */
export function extractGroupResizeRfChanges(
  changes: NodeChange[],
  groupId: string,
  frozen: GroupResizeFrozenAbs,
): NodeChange[] {
  return changes.filter((c) => {
    if (!("id" in c) || typeof c.id !== "string") return false;
    if (frozen.has(c.id)) return false;
    if (c.id !== groupId) return false;
    if (c.type === "dimensions") return "resizing" in c;
    if (c.type === "position") return true;
    return false;
  });
}

export function applyLibtvGroupResizeFrame(
  rfBeforeChange: CanvasFlowNode[],
  rfChanges: NodeChange[],
  groupId: string,
  frozen: GroupResizeFrozenAbs,
): CanvasFlowNode[] {
  const groupOnlyChanges = rfChanges.filter(
    (c) => !("id" in c && typeof c.id === "string" && frozen.has(c.id)),
  );
  if (groupOnlyChanges.length === 0) return rfBeforeChange;
  const next = syncNodeDimensionsFromChanges(
    applyNodeChanges(groupOnlyChanges, rfBeforeChange) as CanvasFlowNode[],
    groupOnlyChanges,
  );
  const group = next.find((n) => n.id === groupId);
  if (!group) return next;
  let changed = next !== rfBeforeChange;
  const pinned = next.map((n) => {
    const abs = frozen.get(n.id);
    if (!abs) return n;
    const position = {
      x: abs.x - group.position.x,
      y: abs.y - group.position.y,
    };
    if (
      n.parentId === groupId &&
      n.extent === undefined &&
      n.position.x === position.x &&
      n.position.y === position.y
    ) {
      return n;
    }
    changed = true;
    return {
      ...n,
      parentId: groupId,
      extent: undefined,
      position,
    };
  });
  return alignRfNodesMeasuredToBox(changed ? pinned : rfBeforeChange);
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
