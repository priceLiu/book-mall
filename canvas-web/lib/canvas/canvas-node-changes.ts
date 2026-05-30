import type { NodeChange } from "@xyflow/react";

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
