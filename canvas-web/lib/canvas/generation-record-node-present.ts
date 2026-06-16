import type { CanvasGenerationRecord } from "@/lib/canvas-api";

/** 当前画布页：优先用 live store；跨项目记录用 API 的 nodePresent。 */
export function resolveGenerationRecordNodePresent(
  item: CanvasGenerationRecord,
  currentProjectId: string,
  liveNodeIds: ReadonlySet<string>,
): boolean | null {
  if (!item.nodeId) return null;
  const pid = item.projectId ?? currentProjectId;
  if (pid === currentProjectId) {
    return liveNodeIds.has(item.nodeId);
  }
  return item.nodePresent ?? false;
}

export function generationRecordNodePresentLabel(
  nodePresent: boolean | null,
  canRestoreCanvas: boolean,
): string | null {
  if (nodePresent === null) return null;
  if (nodePresent) return "节点仍在";
  return canRestoreCanvas ? "节点已不在 · 可恢复画布" : "节点已不在";
}
