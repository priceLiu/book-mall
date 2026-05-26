"use client";

import {
  buildDefaultFrameRowPrompt,
  sanitizeLegacyFramePrompt,
  syncColumnsFromHub,
} from "./story-column-sync";
import type {
  StoryCharacterRow,
  StoryFrameRow,
  StoryVideoRow,
  StoryWorkspaceIds,
} from "./story-workspace-types";
import type { CanvasFlowNode } from "./types";

export function findStoryWorkspaceIds(
  nodes: CanvasFlowNode[],
): StoryWorkspaceIds | null {
  const starter = nodes.find((n) => n.type === "story-comic-starter");
  const ws = (starter?.data as { workspaceIds?: StoryWorkspaceIds })
    ?.workspaceIds;
  if (!ws?.scriptHubId) return null;
  return ws;
}

function syncForWorkspace(nodes: CanvasFlowNode[], ws: StoryWorkspaceIds) {
  if (
    !ws.characterColumnId ||
    !ws.frameColumnId ||
    !ws.videoColumnId
  ) {
    return null;
  }
  return syncColumnsFromHub(
    nodes,
    ws.scriptHubId,
    ws.characterColumnId,
    ws.frameColumnId,
    ws.videoColumnId,
  );
}

/** 始终以故事大纲为准合并行数据（保留已生成 runtime / 用户已保存的 prompt） */
export function displayCharacterRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryCharacterRow[],
): StoryCharacterRow[] {
  const ws = findStoryWorkspaceIds(nodes);
  if (!ws?.characterColumnId || ws.characterColumnId !== columnId) {
    return stored;
  }
  const hubId = ws.scriptHubId;
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = (col?.data as { hubNodeId?: string })?.hubNodeId ?? hubId;
  const synced = syncColumnsFromHub(
    nodes,
    hubNodeId,
    ws.characterColumnId,
    ws.frameColumnId!,
    ws.videoColumnId!,
  );
  return synced?.characterPatch.rows ?? stored;
}

export function displayFrameRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryFrameRow[],
): StoryFrameRow[] {
  const ws = findStoryWorkspaceIds(nodes);
  if (!ws?.frameColumnId || ws.frameColumnId !== columnId) {
    return stored;
  }
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId =
    (col?.data as { hubNodeId?: string })?.hubNodeId ?? ws.scriptHubId;
  const synced = syncColumnsFromHub(
    nodes,
    hubNodeId,
    ws.characterColumnId!,
    ws.frameColumnId,
    ws.videoColumnId!,
  );
  const rows = synced?.framePatch.rows ?? stored;
  return rows.map((row) => {
    const cleaned = row.prompt?.trim()
      ? sanitizeLegacyFramePrompt(row.prompt)
      : "";
    const prompt = cleaned || buildDefaultFrameRowPrompt(row);
    if (prompt === row.prompt) return row;
    return { ...row, prompt };
  });
}

export function displayVideoRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryVideoRow[],
): StoryVideoRow[] {
  const ws = findStoryWorkspaceIds(nodes);
  if (!ws?.videoColumnId || ws.videoColumnId !== columnId) {
    return stored;
  }
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId =
    (col?.data as { hubNodeId?: string })?.hubNodeId ?? ws.scriptHubId;
  const synced = syncColumnsFromHub(
    nodes,
    hubNodeId,
    ws.characterColumnId!,
    ws.frameColumnId!,
    ws.videoColumnId,
  );
  return synced?.videoPatch.rows ?? stored;
}

export function resyncStoryMediaColumnsToStore(
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  const ws = findStoryWorkspaceIds(nodes);
  if (!ws?.characterColumnId || !ws.frameColumnId || !ws.videoColumnId) {
    return false;
  }
  const synced = syncForWorkspace(nodes, ws);
  if (!synced) return false;
  updateNodeData(ws.characterColumnId, synced.characterPatch);
  updateNodeData(ws.frameColumnId, synced.framePatch);
  updateNodeData(ws.videoColumnId, synced.videoPatch);
  return true;
}
