import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import type { CrewBulletinTask } from "./crew-bulletin-types";
import type { CanvasFlowNode } from "./types";

/** 已完成任务 · 从画布工作节点取预览图 URL（仅 done 时调用） */
export function resolveCrewTaskWorkPreviewUrl(
  task: CrewBulletinTask,
  nodes: CanvasFlowNode[],
): string | undefined {
  if (task.status !== "done" || !task.canvasNodeId) return undefined;
  const node = nodes.find((n) => n.id === task.canvasNodeId);
  if (!node) return undefined;

  const d = node.data as {
    ossUrl?: string;
    blobUrl?: string;
    modelKey?: string;
    runtime?: { ossUrl?: string; ephemeralUrl?: string; status?: string };
  };

  return (
    pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ??
    d.ossUrl?.trim() ??
    d.blobUrl?.trim() ??
    undefined
  );
}
