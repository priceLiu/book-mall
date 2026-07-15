"use client";

import { canvasNotify } from "./canvas-notify";
import { useCanvasStore } from "./store";

export const CANVAS_GRAPH_UNDO_REDO_EVENT = "canvas:graph-undo-redo";

function dispatchGraphUndoRedo(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CANVAS_GRAPH_UNDO_REDO_EVENT));
}

/** 撤销：恢复 tracking、执行 undo、强制 RF 与 store 对齐 */
export function canvasGraphUndo(): boolean {
  const temporal = useCanvasStore.temporal.getState();
  if (!temporal.isTracking) temporal.resume();
  if (!temporal.pastStates.length) {
    canvasNotify({
      title: "无法撤销",
      message: "当前没有可撤销的操作。",
    });
    return false;
  }
  temporal.undo();
  useCanvasStore.setState((s) => ({ graphRevision: s.graphRevision + 1 }));
  dispatchGraphUndoRedo();
  return true;
}

/** 重做 */
export function canvasGraphRedo(): boolean {
  const temporal = useCanvasStore.temporal.getState();
  if (!temporal.isTracking) temporal.resume();
  if (!temporal.futureStates.length) {
    canvasNotify({
      title: "无法重做",
      message: "当前没有可重做的操作。",
    });
    return false;
  }
  temporal.redo();
  useCanvasStore.setState((s) => ({ graphRevision: s.graphRevision + 1 }));
  dispatchGraphUndoRedo();
  return true;
}
