"use client";

import {
  buildDefaultFrameRowPrompt,
  sanitizeLegacyFramePrompt,
  syncColumnsFromHub,
} from "./story-column-sync";
import { syncStoryProColumnRows } from "./story-pro-column-sync";
import type {
  StoryCharacterRow,
  StoryFrameRow,
  StoryVideoRow,
  StoryWorkspaceIds,
} from "./story-workspace-types";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { isCanvasInflightStatus } from "./story-column-runtime";
import { findWorkspaceForScriptHub } from "./spawn-story-workspace";
import { hubDataForColumnSync } from "./story-hub-runtime";

export function findWorkspaceForColumnId(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  columnId: string,
): StoryWorkspaceIds | null {
  const col = nodes.find((n) => n.id === columnId);
  if (!col) return null;
  const hubNodeId = (col.data as { hubNodeId?: string }).hubNodeId;
  if (hubNodeId) {
    return findWorkspaceForScriptHub(nodes, edges, hubNodeId);
  }
  for (const n of nodes) {
    if (n.type !== "story-comic-starter") continue;
    const ws = (n.data as { workspaceIds?: StoryWorkspaceIds }).workspaceIds;
    if (!ws?.scriptHubId) continue;
    if (
      ws.characterColumnId === columnId ||
      ws.frameColumnId === columnId ||
      ws.videoColumnId === columnId
    ) {
      return findWorkspaceForScriptHub(nodes, edges, ws.scriptHubId);
    }
  }
  return null;
}

/** 分镜列 → 视频列：优先 workspaceIds，其次边连接，最后全局查找 */
export function resolveStoryVideoColumnId(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  frameColumnId: string,
  ws?: StoryWorkspaceIds | null,
): string | undefined {
  const fromWs = ws?.videoColumnId;
  if (fromWs) {
    const hit = nodes.find(
      (n) => n.id === fromWs && n.type === "story-video-column",
    );
    if (hit) return hit.id;
  }
  const fromEdge = edges
    .filter((e) => e.source === frameColumnId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === "story-video-column");
  if (fromEdge) return fromEdge.id;
  return undefined;
}

function syncForWorkspace(
  nodes: CanvasFlowNode[],
  ws: StoryWorkspaceIds,
) {
  if (
    !ws.characterColumnId ||
    !ws.frameColumnId ||
    !ws.videoColumnId
  ) {
    return null;
  }
  const hub = nodes.find((n) => n.id === ws.scriptHubId);
  const hubData = hub?.data as import("./story-workspace-types").StoryScriptHubNodeData | undefined;
  const nodesForSync =
    hub && hubData
      ? nodes.map((n) =>
          n.id === ws.scriptHubId
            ? { ...n, data: hubDataForColumnSync(hubData) }
            : n,
        )
      : nodes;
  return syncColumnsFromHub(
    nodesForSync,
    ws.scriptHubId,
    ws.characterColumnId,
    ws.frameColumnId,
    ws.videoColumnId,
  );
}

/** @deprecated 多工作流画布请用 findWorkspaceForColumnId / findWorkspaceForScriptHub */
export function findStoryWorkspaceIds(
  nodes: CanvasFlowNode[],
): StoryWorkspaceIds | null {
  const starter = nodes.find((n) => n.type === "story-comic-starter");
  const ws = (starter?.data as { workspaceIds?: StoryWorkspaceIds })
    ?.workspaceIds;
  if (!ws?.scriptHubId) return null;
  return ws;
}

function columnHubNodeId(col: CanvasFlowNode | undefined): string | undefined {
  return (col?.data as { hubNodeId?: string })?.hubNodeId;
}

function siblingColumnsForHub(
  nodes: CanvasFlowNode[],
  hubNodeId: string,
): {
  characterColumnId?: string;
  frameColumnId?: string;
  videoColumnId?: string;
} {
  const out: {
    characterColumnId?: string;
    frameColumnId?: string;
    videoColumnId?: string;
  } = {};
  for (const n of nodes) {
    if (columnHubNodeId(n) !== hubNodeId) continue;
    if (n.type === "story-character-column" || n.type === "story-pro-character") {
      out.characterColumnId = n.id;
    }
    if (n.type === "story-frame-column" || n.type === "story-pro-frame") {
      out.frameColumnId = n.id;
    }
    if (n.type === "story-video-column" || n.type === "story-pro-video") {
      out.videoColumnId = n.id;
    }
  }
  return out;
}

/** 始终以故事大纲为准合并行数据（保留已生成 runtime / 用户已保存的 prompt） */
export function displayCharacterRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryCharacterRow[],
): StoryCharacterRow[] {
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId) return stored;
  const siblings = siblingColumnsForHub(nodes, hubNodeId);
  if (
    !siblings.characterColumnId ||
    siblings.characterColumnId !== columnId ||
    !siblings.frameColumnId ||
    !siblings.videoColumnId
  ) {
    return stored;
  }
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (hub?.type === "story-pro-script-hub") {
    const charNode = nodes.find((n) => n.id === siblings.characterColumnId);
    const frameNode = nodes.find((n) => n.id === siblings.frameColumnId);
    const videoNode = nodes.find((n) => n.id === siblings.videoColumnId);
    const synced = syncStoryProColumnRows(
      hubDataForColumnSync(
        hub.data as StoryProScriptHubNodeData,
      ) as StoryProScriptHubNodeData,
      {
        characterRows: (charNode?.data as { rows?: StoryProCharacterRow[] })
          ?.rows,
        frameRows: (frameNode?.data as { rows?: StoryProFrameRow[] })?.rows,
        videoRows: (videoNode?.data as { rows?: StoryProVideoRow[] })?.rows,
      },
    );
    return synced.characterRows;
  }
  const hubData = hub?.data as import("./story-workspace-types").StoryScriptHubNodeData | undefined;
  const nodesForSync =
    hub && hubData
      ? nodes.map((n) =>
          n.id === hubNodeId
            ? { ...n, data: hubDataForColumnSync(hubData) }
            : n,
        )
      : nodes;
  const synced = syncColumnsFromHub(
    nodesForSync,
    hubNodeId,
    siblings.characterColumnId,
    siblings.frameColumnId,
    siblings.videoColumnId,
  );
  return synced?.characterPatch.rows ?? stored;
}

export function displayFrameRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryFrameRow[],
): StoryFrameRow[] {
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId) return stored;
  const siblings = siblingColumnsForHub(nodes, hubNodeId);
  if (
    !siblings.frameColumnId ||
    siblings.frameColumnId !== columnId ||
    !siblings.characterColumnId ||
    !siblings.videoColumnId
  ) {
    return stored;
  }
  const hub = nodes.find((n) => n.id === hubNodeId);
  const hubData = hub?.data as import("./story-workspace-types").StoryScriptHubNodeData | undefined;
  const nodesForSync =
    hub && hubData
      ? nodes.map((n) =>
          n.id === hubNodeId
            ? { ...n, data: hubDataForColumnSync(hubData) }
            : n,
        )
      : nodes;
  const synced = syncColumnsFromHub(
    nodesForSync,
    hubNodeId,
    siblings.characterColumnId,
    siblings.frameColumnId,
    siblings.videoColumnId,
  );
  const rows = synced?.framePatch.rows ?? stored;
  const storedByKey = new Map(stored.map((r) => [r.key, r]));
  return rows.map((row) => {
    const prev = storedByKey.get(row.key);
    const cleaned = row.prompt?.trim()
      ? sanitizeLegacyFramePrompt(row.prompt)
      : "";
    const prompt = cleaned || buildDefaultFrameRowPrompt(row);
    let next = prompt === row.prompt ? row : { ...row, prompt };
    if (prev?.frameApprovedAt) {
      next = { ...next, frameApprovedAt: prev.frameApprovedAt };
    }
    if (prev?.frameRejectedReason) {
      next = { ...next, frameRejectedReason: prev.frameRejectedReason };
    }
    return next;
  });
}

/** 分镜列 stored + hub 合并，保留已生成分镜图 runtime（供视频生成同步） */
export function frameRowsForVideoSync(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  storedFrameRows: StoryFrameRow[],
): StoryFrameRow[] {
  const displayed = displayFrameRows(nodes, frameColumnId, storedFrameRows);
  const storedByKey = new Map(storedFrameRows.map((r) => [r.key, r]));
  return displayed.map((row) => {
    const prev = storedByKey.get(row.key);
    if (!prev) return row;
    return {
      ...row,
      runtime: prev.runtime ?? row.runtime,
      prompt: prev.prompt?.trim() ? prev.prompt : row.prompt,
      refImages: prev.refImages?.length ? prev.refImages : row.refImages,
      referencedNodeIds: prev.referencedNodeIds ?? row.referencedNodeIds,
      frameApprovedAt: prev.frameApprovedAt ?? row.frameApprovedAt,
      frameRejectedReason: prev.frameRejectedReason ?? row.frameRejectedReason,
    };
  });
}

function pickRowRuntime<T extends { status?: string } | undefined>(
  stored?: T,
  synced?: T,
): T | undefined {
  if (isCanvasInflightStatus(stored?.status)) return stored;
  if (isCanvasInflightStatus(synced?.status)) return synced;
  return stored ?? synced;
}

export function displayVideoRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryVideoRow[],
): StoryVideoRow[] {
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId) return stored;
  const siblings = siblingColumnsForHub(nodes, hubNodeId);
  if (
    !siblings.videoColumnId ||
    siblings.videoColumnId !== columnId ||
    !siblings.characterColumnId ||
    !siblings.frameColumnId
  ) {
    return stored;
  }
  const hub = nodes.find((n) => n.id === hubNodeId);
  const hubData = hub?.data as import("./story-workspace-types").StoryScriptHubNodeData | undefined;
  const nodesForSync =
    hub && hubData
      ? nodes.map((n) =>
          n.id === hubNodeId
            ? { ...n, data: hubDataForColumnSync(hubData) }
            : n,
        )
      : nodes;
  const synced = syncColumnsFromHub(
    nodesForSync,
    hubNodeId,
    siblings.characterColumnId,
    siblings.frameColumnId,
    siblings.videoColumnId,
  );
  const syncedRows = synced?.videoPatch.rows ?? stored;
  const storedByKey = new Map(stored.map((r) => [r.key, r]));
  return syncedRows.map((row) => {
    const prev = storedByKey.get(row.key);
    if (!prev) return row;
    return {
      ...row,
      videoRuntime: pickRowRuntime(prev.videoRuntime, row.videoRuntime),
      ttsRuntime: pickRowRuntime(prev.ttsRuntime, row.ttsRuntime),
      videoPrompt: prev.videoPrompt?.trim() ? prev.videoPrompt : row.videoPrompt,
      ttsPrompt: prev.ttsPrompt?.trim() ? prev.ttsPrompt : row.ttsPrompt,
      videoPromptHistory: prev.videoPromptHistory ?? row.videoPromptHistory,
      ttsPromptHistory: prev.ttsPromptHistory ?? row.ttsPromptHistory,
    };
  });
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
