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
    return false;
  });
}
