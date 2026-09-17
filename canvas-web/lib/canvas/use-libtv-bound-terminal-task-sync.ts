"use client";

import { useLayoutEffect, useMemo } from "react";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  findBoundTerminalCanvasTask,
  shouldApplyCanvasTaskRuntimePatch,
  shouldSkipStoryRowTaskApply,
  shouldSyncBoundTerminalCanvasTask,
} from "@/lib/canvas/task-pick";
import type { CanvasNodeRuntime } from "@/lib/canvas/types";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import {
  isSameSbv1MediaDataPatch,
  sbv1ImagePatchFromTask,
  sbv1VideoPatchFromTask,
} from "@/lib/canvas/sbv1-image-task-apply";

type LibtvBoundTerminalMediaKind = "image" | "video";

function buildLibtvBoundTerminalPatch(
  kind: LibtvBoundTerminalMediaKind,
  task: CanvasTaskRecord,
  nodeData: Record<string, unknown>,
): Record<string, unknown> | null {
  if (kind === "video") {
    return sbv1VideoPatchFromTask(task);
  }
  return sbv1ImagePatchFromTask(
    nodeData as unknown as Sbv1ImageNodeData,
    task,
  );
}

/** 绑定任务已终态但本地仍扫光时，立即写回 runtime（不受其它 stale inflight 阻塞） */
export function useLibtvBoundTerminalTaskSync(args: {
  nodeId: string;
  taskHistory: CanvasTaskRecord[];
  boundTaskId?: string | null;
  mediaKind: LibtvBoundTerminalMediaKind;
}) {
  const { nodeId, taskHistory, boundTaskId, mediaKind } = args;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const boundTerminalTask = useMemo(
    () => findBoundTerminalCanvasTask(taskHistory, boundTaskId),
    [taskHistory, boundTaskId],
  );

  useLayoutEffect(() => {
    if (!boundTerminalTask) return;

    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    const localRt = (node?.data as { runtime?: CanvasNodeRuntime } | undefined)
      ?.runtime;
    if (!shouldSyncBoundTerminalCanvasTask(localRt, boundTerminalTask)) return;
    if (shouldSkipStoryRowTaskApply(localRt, boundTerminalTask, nodeId)) return;

    const nodePatch = buildLibtvBoundTerminalPatch(
      mediaKind,
      boundTerminalTask,
      (node?.data ?? {}) as Record<string, unknown>,
    );
    if (!nodePatch) return;
    const rtPatch = nodePatch.runtime as Partial<CanvasNodeRuntime> | undefined;
    if (!rtPatch) return;
    if (
      !shouldApplyCanvasTaskRuntimePatch(
        localRt,
        boundTerminalTask,
        rtPatch,
        nodeId,
      )
    ) {
      return;
    }
    if (
      isSameSbv1MediaDataPatch(
        node?.data as Record<string, unknown>,
        nodePatch,
      )
    ) {
      return;
    }
    updateNodeData(nodeId, nodePatch);
  }, [boundTerminalTask, nodeId, updateNodeData, mediaKind, taskHistory]);

  return boundTerminalTask;
}
