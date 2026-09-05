/**
 * 画布落盘快照 · 与 graphRevision 解耦的内容判脏
 *
 * strip 后 JSON 一致则视为「已保存」，避免 revision 连跳触发空 PATCH。
 * 有真实改动时 autosave 走 canvasDelta 增量 PATCH（见 canvas-persist-delta.ts）。
 */

import { stripGraphForPersist } from "./sanitize";
import { stripStoryProUploadedScriptMdForPersist } from "./story-pro-upload-script";
import type { CanvasGraph } from "./types";

export type CanvasPersistSnapshot = {
  revision: number;
  viewport: string;
  graph: string;
};

export function buildCanvasPersistGraph(
  toGraph: () => CanvasGraph,
): CanvasGraph {
  return stripStoryProUploadedScriptMdForPersist(
    stripGraphForPersist(toGraph()),
  );
}

export function serializeCanvasPersistGraph(graph: CanvasGraph): string {
  return JSON.stringify(graph);
}

export function readCanvasPersistSnapshot(state: {
  graphRevision: number;
  viewport: unknown;
  toGraph: () => CanvasGraph;
}): CanvasPersistSnapshot {
  return {
    revision: state.graphRevision,
    viewport: JSON.stringify(state.viewport),
    graph: serializeCanvasPersistGraph(buildCanvasPersistGraph(state.toGraph)),
  };
}

/** 含 revision：供调试 / 历史心跳 */
export function isCanvasPersistSnapshotRevisionDirty(
  current: CanvasPersistSnapshot,
  persisted: CanvasPersistSnapshot | null,
): boolean {
  if (!persisted) return true;
  return (
    current.revision !== persisted.revision ||
    current.viewport !== persisted.viewport ||
    current.graph !== persisted.graph
  );
}

/** 落盘判脏：只看 strip 后内容与视口（uploading/blob 等 transient 不计） */
export function isCanvasPersistContentDirty(
  current: CanvasPersistSnapshot,
  persisted: CanvasPersistSnapshot | null,
): boolean {
  if (!persisted) return true;
  return (
    current.viewport !== persisted.viewport || current.graph !== persisted.graph
  );
}
