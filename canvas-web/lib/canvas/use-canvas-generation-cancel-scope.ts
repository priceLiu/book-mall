"use client";

import type { CanvasCancelGenerationJob } from "./canvas-run-bus";
import { findStarterByHubId } from "./story-workspace-resolver";
import type { CanvasFlowNode } from "./types";

function resolveColumnIdForMediaKind(
  starter: CanvasFlowNode | undefined,
  mediaKind: CanvasCancelGenerationJob["mediaKind"],
): string | undefined {
  const ws = (
    starter?.data as {
      workspaceIds?: {
        characterColumnId?: string;
        frameColumnId?: string;
        videoColumnId?: string;
      };
    }
  )?.workspaceIds;
  if (mediaKind === "threeView") return ws?.characterColumnId;
  if (mediaKind === "frameImage") return ws?.frameColumnId;
  if (mediaKind === "video" || mediaKind === "tts") return ws?.videoColumnId;
  return undefined;
}

export function resolvePro2BoardRowCancelScope(
  nodes: CanvasFlowNode[],
  input: {
    hubNodeId?: string;
    rowKey?: string;
    mediaKind: CanvasCancelGenerationJob["mediaKind"];
    taskId?: string;
  },
): CanvasCancelGenerationJob | undefined {
  const rowKey = input.rowKey?.trim();
  if (!rowKey || !input.hubNodeId?.trim()) return undefined;
  const starter = findStarterByHubId(nodes, input.hubNodeId.trim());
  const nodeId = resolveColumnIdForMediaKind(starter, input.mediaKind);
  if (!nodeId) return undefined;
  return {
    nodeId,
    rowKey,
    mediaKind: input.mediaKind,
    taskId: input.taskId?.trim(),
  };
}

/** @deprecated  prefer resolvePro2BoardRowCancelScope(nodes, input) */
export function usePro2BoardCellCancelScope(input: {
  hubNodeId?: string;
  rowKey?: string;
  mediaKind: CanvasCancelGenerationJob["mediaKind"];
  taskId?: string;
}): CanvasCancelGenerationJob | undefined {
  void input;
  return undefined;
}
