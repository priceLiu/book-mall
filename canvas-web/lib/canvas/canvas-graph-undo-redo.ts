"use client";

import { canvasNotify } from "./canvas-notify";
import { useCanvasStore } from "./store";

export const CANVAS_GRAPH_UNDO_REDO_EVENT = "canvas:graph-undo-redo";

function dispatchGraphUndoRedo(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CANVAS_GRAPH_UNDO_REDO_EVENT));
}

/**
 * 撤销/重做后让 autosave 感知变更。
 * - 必须在 pause 中写：zundo 的任何新 set 都会清空 futureStates（重做栈）。
 * - `graphRevision` 会随快照一起回滚，须跳到比回滚前更大的值保持单调；
 *   否则可能与「已保存的那个 revision」撞号，autosave 误判已保存而丢掉本次撤销。
 */
function markGraphChangedWithoutTracking(revisionBefore: number): void {
  const temporal = useCanvasStore.temporal.getState();
  const wasTracking = temporal.isTracking;
  temporal.pause();
  useCanvasStore.setState((s) => ({
    graphRevision: Math.max(revisionBefore, s.graphRevision) + 1,
  }));
  if (wasTracking) temporal.resume();
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
  const revisionBefore = useCanvasStore.getState().graphRevision;
  temporal.undo();
  markGraphChangedWithoutTracking(revisionBefore);
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
  const revisionBefore = useCanvasStore.getState().graphRevision;
  temporal.redo();
  markGraphChangedWithoutTracking(revisionBefore);
  dispatchGraphUndoRedo();
  return true;
}
