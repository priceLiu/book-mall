"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { isLibtvFreestandingImageNode } from "./libtv-image-node-run";
import {
  isSameSbv1MediaDataPatch,
  sbv1ImagePatchFromTask,
  sbv1VideoPatchFromTask,
} from "./sbv1-image-task-apply";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import { isCanvasInflightStatus } from "./story-column-runtime";
import {
  pickActiveServerInflightTask,
  runtimePatchFromCanvasTask,
} from "./task-pick";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";

function nodeTasksForRestore(
  node: CanvasFlowNode,
  tasks: CanvasTaskRecord[],
): CanvasTaskRecord[] {
  const d = node.data as {
    pro2MediaRole?: string;
    pro2ControllerNodeId?: string;
    pro2RowKey?: string;
  };
  if (
    node.type === "sbv1-video-engine" &&
    d.pro2MediaRole === "video" &&
    d.pro2ControllerNodeId?.trim()
  ) {
    const controllerId = d.pro2ControllerNodeId.trim();
    const rowKey = d.pro2RowKey?.trim() ?? "";
    return tasks.filter(
      (t) =>
        t.nodeId === controllerId &&
        t.storyScope?.rowKey === rowKey &&
        t.storyScope?.mediaKind === "video",
    );
  }
  return tasks.filter((t) => t.nodeId === node.id);
}

function shouldRestoreInflight(
  localRt: CanvasNodeRuntime | undefined,
  inflight: CanvasTaskRecord,
): boolean {
  if (!isCanvasInflightStatus(localRt?.status)) return true;
  const bound = localRt?.taskId?.trim();
  return !bound || bound !== inflight.id;
}

/**
 * 刷新 / 轮询后：服务端仍有 QUEUED…SUBMITTED，但节点 runtime 已 idle 或未绑定 taskId 时，
 * 从任务表恢复「生成中」态，避免 UI 与 Gateway 日志脱节。
 */
export function restoreServerInflightNodeRuntimes(
  nodes: CanvasFlowNode[],
  tasks: CanvasTaskRecord[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  setNodeRuntime: (id: string, patch: Partial<CanvasNodeRuntime>) => void,
): void {
  for (const node of nodes) {
    if (node.type === "sbv1-video-engine") {
      const localRt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
      const scoped = nodeTasksForRestore(node, tasks);
      const inflight = pickActiveServerInflightTask(
        scoped,
        localRt?.taskId,
        localRt,
      );
      if (!inflight || !shouldRestoreInflight(localRt, inflight)) continue;
      const patch = sbv1VideoPatchFromTask(inflight);
      if (!patch) continue;
      if (
        isSameSbv1MediaDataPatch(node.data as Record<string, unknown>, patch)
      ) {
        continue;
      }
      updateNodeData(node.id, patch);
      continue;
    }

    if (isLibtvFreestandingImageNode(node)) {
      const prev = node.data as unknown as Sbv1ImageNodeData;
      const localRt = prev.runtime;
      const scoped = tasks.filter((t) => t.nodeId === node.id);
      const inflight = pickActiveServerInflightTask(
        scoped,
        localRt?.taskId,
        localRt,
      );
      if (!inflight || !shouldRestoreInflight(localRt, inflight)) continue;
      const patch = sbv1ImagePatchFromTask(prev, inflight);
      if (!patch) continue;
      if (
        isSameSbv1MediaDataPatch(node.data as Record<string, unknown>, patch)
      ) {
        continue;
      }
      updateNodeData(node.id, patch);
      continue;
    }

    if (node.type === "ai-video-engine") {
      const localRt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
      const scoped = tasks.filter((t) => t.nodeId === node.id);
      const inflight = pickActiveServerInflightTask(
        scoped,
        localRt?.taskId,
        localRt,
      );
      if (!inflight || !shouldRestoreInflight(localRt, inflight)) continue;
      const patch = runtimePatchFromCanvasTask(inflight);
      if (!patch) continue;
      setNodeRuntime(node.id, patch);
    }
  }
}
