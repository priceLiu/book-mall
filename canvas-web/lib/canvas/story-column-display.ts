"use client";

import {
  buildDefaultFrameRowPrompt,
  patchVideoRowsFromFrameRows,
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
  StoryProSceneRow,
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { isCanvasInflightStatus } from "./story-column-runtime";
import { findStoryProWorkspaceFromHub } from "./spawn-story-pro-workspace";
import { findStoryPro2WorkspaceFromHub } from "./spawn-story-pro2-workspace";
import { findWorkspaceForScriptHub } from "./spawn-story-workspace";
import { hubDataForColumnSync } from "./story-hub-runtime";
import {
  isAnyStoryCharacterColumnType,
  isAnyStoryFrameColumnType,
  isAnyStorySceneColumnType,
  isAnyStoryVideoColumnType,
} from "./story-workspace-resolver";

function isStoryProScriptHubType(type: string | undefined): boolean {
  return type === "story-pro-script-hub" || type === "story-pro2-script-hub";
}

function workspaceFromProScriptHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubNodeId: string,
  hubType: string | undefined,
): StoryWorkspaceIds | null {
  if (hubType === "story-pro-script-hub") {
    const pro = findStoryProWorkspaceFromHub(nodes, edges, hubNodeId);
    if (!pro) return null;
    return {
      scriptHubId: pro.scriptHubId,
      characterColumnId: pro.characterColumnId,
      frameColumnId: pro.frameColumnId,
      videoColumnId: pro.videoColumnId,
      jianyingExportId: pro.jianyingExportId,
      sceneColumnId: pro.sceneColumnId,
      styleNodeId: pro.styleNodeId,
    } as StoryWorkspaceIds & {
      sceneColumnId?: string;
      styleNodeId?: string;
    };
  }
  if (hubType === "story-pro2-script-hub") {
    const pro2 = findStoryPro2WorkspaceFromHub(nodes, edges, hubNodeId);
    if (!pro2) return null;
    return {
      scriptHubId: pro2.scriptHubId,
      characterColumnId: pro2.characterColumnId,
      frameColumnId: pro2.frameColumnId,
      videoColumnId: pro2.videoColumnId,
      sceneColumnId: pro2.sceneColumnId,
      styleNodeId: pro2.styleNodeId,
    } as StoryWorkspaceIds & {
      sceneColumnId?: string;
      styleNodeId?: string;
    };
  }
  return null;
}

export function findWorkspaceForColumnId(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  columnId: string,
): StoryWorkspaceIds | null {
  const col = nodes.find((n) => n.id === columnId);
  if (!col) return null;
  const hubNodeId = (col.data as { hubNodeId?: string }).hubNodeId;
  if (hubNodeId) {
    const hub = nodes.find((n) => n.id === hubNodeId);
    const proWs = workspaceFromProScriptHub(nodes, edges, hubNodeId, hub?.type);
    if (proWs) return proWs;
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

function isStoryFrameColumnType(type: string | undefined): boolean {
  return isAnyStoryFrameColumnType(type ?? "");
}

function storyColumnRowCount(node: CanvasFlowNode | undefined): number {
  return ((node?.data as { rows?: unknown[] })?.rows?.length ?? 0) as number;
}

function pickFrameAmongCandidates(
  nodes: CanvasFlowNode[],
  candidates: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): string | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0]!.id;
  return [...candidates].sort((a, b) => {
    const na = effectiveFrameRowsForColumn(nodes, a.id, edges).length;
    const nb = effectiveFrameRowsForColumn(nodes, b.id, edges).length;
    return nb - na;
  })[0]!.id;
}

/**
 * 视频列应对齐的分镜脚本列。
 * 在同 hub 下汇总连线 / 兄弟列 / workspace / data 中的候选，取镜位最多的一列（避免旧边连到短列）。
 */
export function pickFrameColumnIdForVideoNode(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  videoColumnId: string,
  ws?: StoryWorkspaceIds | null,
): string | undefined {
  const video = nodes.find((n) => n.id === videoColumnId);
  if (!video) return undefined;

  const hubNodeId = columnHubNodeId(video);
  const candidates: CanvasFlowNode[] = [];

  const pushCandidate = (
    node: CanvasFlowNode | undefined,
    opts?: { ignoreHub?: boolean },
  ) => {
    if (!node || !isStoryFrameColumnType(node.type)) return;
    if (
      hubNodeId &&
      !opts?.ignoreHub &&
      columnHubNodeId(node) !== hubNodeId
    ) {
      return;
    }
    if (!candidates.some((c) => c.id === node.id)) candidates.push(node);
  };

  for (const e of edges) {
    if (e.target !== videoColumnId) continue;
    /** 画布连线优先：允许跨 hub（旧图可能 frame/video 的 hubNodeId 不一致） */
    pushCandidate(nodes.find((n) => n.id === e.source), { ignoreHub: true });
  }

  if (hubNodeId) {
    for (const n of nodes) {
      if (
        isStoryFrameColumnType(n.type) &&
        columnHubNodeId(n) === hubNodeId
      ) {
        pushCandidate(n);
      }
    }
  }

  const fromWs = ws?.frameColumnId;
  if (fromWs) pushCandidate(nodes.find((n) => n.id === fromWs));

  const fromData = (video.data as { frameColumnId?: string }).frameColumnId;
  if (fromData) pushCandidate(nodes.find((n) => n.id === fromData));

  let pick = pickFrameAmongCandidates(nodes, candidates, edges);
  if (!pick && hubNodeId) {
    const hubFrames = nodes.filter(
      (n) =>
        isStoryFrameColumnType(n.type) && columnHubNodeId(n) === hubNodeId,
    );
    pick = pickFrameAmongCandidates(nodes, hubFrames, edges);
  }
  if (!pick) {
    const allFrames = nodes.filter((n) => isStoryFrameColumnType(n.type));
    pick = pickFrameAmongCandidates(nodes, allFrames, edges);
  }
  return pick;
}

/** 视频列应对齐的分镜脚本镜位（与分镜脚本列 UI 一致） */
export function frameRowsForVideoColumn(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  videoColumnId: string,
  ws?: StoryWorkspaceIds | null,
): { frameColumnId?: string; frameRows: StoryFrameRow[] } {
  const frameColumnId = pickFrameColumnIdForVideoNode(
    nodes,
    edges,
    videoColumnId,
    ws,
  );
  if (!frameColumnId) return { frameRows: [] };
  const frameNode = nodes.find((n) => n.id === frameColumnId);
  const stored =
    (frameNode?.data as { rows?: StoryFrameRow[] })?.rows ?? [];
  return {
    frameColumnId,
    frameRows: effectiveFrameRowsForColumn(nodes, frameColumnId, edges),
  };
}

/** @deprecated 使用 {@link pickFrameColumnIdForVideoNode} */
export function resolveStoryFrameColumnId(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  videoColumnId: string,
  ws?: StoryWorkspaceIds | null,
): string | undefined {
  return pickFrameColumnIdForVideoNode(nodes, edges, videoColumnId, ws);
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
      (n) => n.id === fromWs && isAnyStoryVideoColumnType(n.type ?? ""),
    );
    if (hit) return hit.id;
  }
  const fromEdge = edges
    .filter((e) => e.source === frameColumnId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => isAnyStoryVideoColumnType(n?.type ?? ""));
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
  edges: CanvasFlowEdge[] = [],
): {
  characterColumnId?: string;
  sceneColumnId?: string;
  frameColumnId?: string;
  videoColumnId?: string;
} {
  const characters: CanvasFlowNode[] = [];
  const scenes: CanvasFlowNode[] = [];
  const frames: CanvasFlowNode[] = [];
  const videos: CanvasFlowNode[] = [];
  for (const n of nodes) {
    if (columnHubNodeId(n) !== hubNodeId) continue;
    if (isAnyStoryCharacterColumnType(n.type ?? "")) {
      characters.push(n);
    }
    if (isAnyStorySceneColumnType(n.type ?? "")) {
      scenes.push(n);
    }
    if (isAnyStoryFrameColumnType(n.type ?? "")) {
      frames.push(n);
    }
    if (isAnyStoryVideoColumnType(n.type ?? "")) {
      videos.push(n);
    }
  }
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (hub?.type === "story-pro-script-hub") {
    const ws = findStoryProWorkspaceFromHub(nodes, edges, hubNodeId);
    if (ws) {
      const frameColumnId =
        ws.frameColumnId ?? pickFrameAmongCandidates(nodes, frames, edges);
      let videoColumnId = ws.videoColumnId;
      if (!videoColumnId && frameColumnId && videos.length > 0) {
        const linked = videos.filter((v) =>
          edges.some((e) => e.source === frameColumnId && e.target === v.id),
        );
        const pool = linked.length > 0 ? linked : videos;
        videoColumnId =
          pool.length === 1
            ? pool[0]!.id
            : [...pool].sort(
                (a, b) =>
                  storyColumnRowCount(b) - storyColumnRowCount(a),
              )[0]?.id;
      }
      return {
        characterColumnId: ws.characterColumnId ?? characters[0]?.id,
        sceneColumnId: ws.sceneColumnId ?? scenes[0]?.id,
        frameColumnId,
        videoColumnId,
      };
    }
  }
  if (hub?.type === "story-pro2-script-hub") {
    const ws = findStoryPro2WorkspaceFromHub(nodes, edges, hubNodeId);
    if (ws) {
      const frameColumnId =
        ws.frameColumnId ?? pickFrameAmongCandidates(nodes, frames, edges);
      let videoColumnId = ws.videoColumnId;
      if (!videoColumnId && frameColumnId && videos.length > 0) {
        const linked = videos.filter((v) =>
          edges.some((e) => e.source === frameColumnId && e.target === v.id),
        );
        const pool = linked.length > 0 ? linked : videos;
        videoColumnId =
          pool.length === 1
            ? pool[0]!.id
            : [...pool].sort(
                (a, b) =>
                  storyColumnRowCount(b) - storyColumnRowCount(a),
              )[0]?.id;
      }
      return {
        characterColumnId: ws.characterColumnId ?? characters[0]?.id,
        sceneColumnId: ws.sceneColumnId ?? scenes[0]?.id,
        frameColumnId,
        videoColumnId,
      };
    }
  }

  const frameColumnId = pickFrameAmongCandidates(nodes, frames, edges);
  let videoColumnId: string | undefined;
  if (frameColumnId && videos.length > 0) {
    const linked = videos.filter((v) =>
      edges.some((e) => e.source === frameColumnId && e.target === v.id),
    );
    const pool = linked.length > 0 ? linked : videos;
    videoColumnId =
      pool.length === 1
        ? pool[0]!.id
        : [...pool].sort((a, b) => {
            const sa =
              (a.data as { rows?: StoryVideoRow[] })?.rows?.length ?? 0;
            const sb =
              (b.data as { rows?: StoryVideoRow[] })?.rows?.length ?? 0;
            return sb - sa;
          })[0]?.id;
  } else {
    videoColumnId = videos[0]?.id;
  }
  return {
    characterColumnId: characters[0]?.id,
    sceneColumnId: scenes[0]?.id,
    frameColumnId,
    videoColumnId,
  };
}

/** 始终以所属故事剧本 hub 拆分场景行（多工作流同名场景不串资产 / runtime） */
export function displaySceneRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryProSceneRow[],
  edges: CanvasFlowEdge[] = [],
): StoryProSceneRow[] {
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId || col?.type !== "story-pro-scene") return stored;
  const siblings = siblingColumnsForHub(nodes, hubNodeId, edges);
  if (!siblings.sceneColumnId || siblings.sceneColumnId !== columnId) {
    return stored;
  }
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (isStoryProScriptHubType(hub?.type)) {
    const synced = syncStoryProColumnRows(
      hubDataForColumnSync(
        hub.data as StoryProScriptHubNodeData,
      ) as StoryProScriptHubNodeData,
      { sceneRows: stored },
      hubNodeId,
    );
    return synced.sceneRows;
  }
  return stored;
}

/** 始终以故事大纲为准合并行数据（保留已生成 runtime / 用户已保存的 prompt） */
export function displayCharacterRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryCharacterRow[],
  edges: CanvasFlowEdge[] = [],
): StoryCharacterRow[] {
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId) return stored;
  const siblings = siblingColumnsForHub(nodes, hubNodeId, edges);
  if (
    !siblings.characterColumnId ||
    siblings.characterColumnId !== columnId ||
    !siblings.frameColumnId ||
    !siblings.videoColumnId
  ) {
    return stored;
  }
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (isStoryProScriptHubType(hub?.type)) {
    const synced = syncStoryProColumnRows(
      hubDataForColumnSync(
        hub.data as StoryProScriptHubNodeData,
      ) as StoryProScriptHubNodeData,
      storyProColumnSyncInput(nodes, siblings),
      hubNodeId,
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

function storyProColumnSyncInput(
  nodes: CanvasFlowNode[],
  siblings: {
    characterColumnId?: string;
    sceneColumnId?: string;
    frameColumnId?: string;
    videoColumnId?: string;
  },
) {
  const charNode = siblings.characterColumnId
    ? nodes.find((n) => n.id === siblings.characterColumnId)
    : undefined;
  const sceneNode = siblings.sceneColumnId
    ? nodes.find((n) => n.id === siblings.sceneColumnId)
    : undefined;
  const frameNode = siblings.frameColumnId
    ? nodes.find((n) => n.id === siblings.frameColumnId)
    : undefined;
  const videoNode = siblings.videoColumnId
    ? nodes.find((n) => n.id === siblings.videoColumnId)
    : undefined;
  return {
    characterRows: (charNode?.data as { rows?: StoryProCharacterRow[] })?.rows,
    sceneRows: (sceneNode?.data as { rows?: StoryProSceneRow[] })?.rows,
    frameRows: (frameNode?.data as { rows?: StoryProFrameRow[] })?.rows,
    videoRows: (videoNode?.data as { rows?: StoryProVideoRow[] })?.rows,
  };
}

function mergeHubFrameRowsWithStored(
  syncedRows: StoryFrameRow[],
  stored: StoryFrameRow[],
): StoryFrameRow[] {
  const storedByKey = new Map(stored.map((r) => [r.key, r]));
  const mapped = syncedRows.map((row) => {
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
  const mappedKeys = new Set(mapped.map((r) => r.key));
  const mappedIndexes = new Set(mapped.map((r) => r.frameIndex));
  const extras = stored.filter(
    (r) => !mappedKeys.has(r.key) && !mappedIndexes.has(r.frameIndex),
  );
  return extras.length ? [...mapped, ...extras] : mapped;
}

/**
 * 指定分镜脚本列的完整镜位（强制以该列 stored 为准做 hub 合并，不受「主列」sibling 限制）。
 * 视频列对齐必须用此函数，否则会与分镜列标题镜数不一致。
 */
export function effectiveFrameRowsForColumn(
  nodes: CanvasFlowNode[],
  columnId: string,
  edges: CanvasFlowEdge[] = [],
): StoryFrameRow[] {
  const col = nodes.find((n) => n.id === columnId);
  if (!col) return [];
  const stored = (col.data as { rows?: StoryFrameRow[] })?.rows ?? [];
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId) return stored;

  const siblings = siblingColumnsForHub(nodes, hubNodeId, edges);
  const siblingsForColumn = { ...siblings, frameColumnId: columnId };
  if (!siblingsForColumn.characterColumnId || !siblingsForColumn.videoColumnId) {
    return stored;
  }

  const hub = nodes.find((n) => n.id === hubNodeId);
  if (isStoryProScriptHubType(hub?.type)) {
    const synced = syncStoryProColumnRows(
      hubDataForColumnSync(
        hub.data as StoryProScriptHubNodeData,
      ) as StoryProScriptHubNodeData,
      storyProColumnSyncInput(nodes, siblingsForColumn),
      hubNodeId,
    );
    return mergeHubFrameRowsWithStored(
      synced.frameRows as StoryFrameRow[],
      stored,
    );
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
    siblingsForColumn.characterColumnId,
    siblingsForColumn.frameColumnId!,
    siblingsForColumn.videoColumnId,
  );
  const rows = synced?.framePatch.rows ?? stored;
  return mergeHubFrameRowsWithStored(rows, stored);
}

export function displayFrameRows(
  nodes: CanvasFlowNode[],
  columnId: string,
  stored: StoryFrameRow[],
  edges: CanvasFlowEdge[] = [],
): StoryFrameRow[] {
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId) return stored;
  const siblings = siblingColumnsForHub(nodes, hubNodeId, edges);
  if (
    !siblings.frameColumnId ||
    siblings.frameColumnId !== columnId ||
    !siblings.characterColumnId ||
    !siblings.videoColumnId
  ) {
    return stored;
  }
  return effectiveFrameRowsForColumn(nodes, columnId, edges);
}

/** 分镜列 stored + hub 合并，保留已生成分镜图 runtime（供视频生成同步） */
export function frameRowsForVideoSync(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  storedFrameRows: StoryFrameRow[],
  edges: CanvasFlowEdge[] = [],
): StoryFrameRow[] {
  const displayed = effectiveFrameRowsForColumn(
    nodes,
    frameColumnId,
    edges,
  );
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
  edges: CanvasFlowEdge[] = [],
): StoryVideoRow[] {
  const col = nodes.find((n) => n.id === columnId);
  const hubNodeId = columnHubNodeId(col);
  if (!hubNodeId) return stored;
  const siblings = siblingColumnsForHub(nodes, hubNodeId, edges);
  if (
    !siblings.videoColumnId ||
    siblings.videoColumnId !== columnId ||
    !siblings.characterColumnId ||
    !siblings.frameColumnId
  ) {
    const frameId = pickFrameColumnIdForVideoNode(
      nodes,
      edges,
      columnId,
      findWorkspaceForColumnId(nodes, edges, columnId),
    );
    if (frameId) {
      return displayVideoRowsForFrameColumn(nodes, columnId, stored, frameId);
    }
    return stored;
  }
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (isStoryProScriptHubType(hub?.type)) {
    const synced = syncStoryProColumnRows(
      hubDataForColumnSync(
        hub.data as StoryProScriptHubNodeData,
      ) as StoryProScriptHubNodeData,
      storyProColumnSyncInput(nodes, siblings),
      hubNodeId,
    );
    const syncedRows = synced.videoRows as StoryVideoRow[];
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

/**
 * 与分镜脚本列对齐的镜位列表（stored 行数多于 hub 合并结果时保留 stored，避免视频列变少）。
 */
export function authoritativeFrameRowsForVideoColumn(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  edges: CanvasFlowEdge[] = [],
): StoryFrameRow[] {
  return effectiveFrameRowsForColumn(nodes, frameColumnId, edges);
}

/**
 * 分镜视频列展示：与分镜脚本列镜数对齐（补齐缺失镜位，保留已生成视频/TTS）。
 */
export function displayVideoRowsForFrameColumn(
  nodes: CanvasFlowNode[],
  videoColumnId: string,
  storedVideo: StoryVideoRow[],
  frameColumnId?: string,
  edges: CanvasFlowEdge[] = [],
): StoryVideoRow[] {
  const video = displayVideoRows(nodes, videoColumnId, storedVideo, edges);
  if (!frameColumnId) return video;
  const frameRows = authoritativeFrameRowsForVideoColumn(
    nodes,
    frameColumnId,
    edges,
  );
  if (!frameRows.length) return video;
  return patchVideoRowsFromFrameRows(video, frameRows);
}

/** 补全「分镜脚本列 → 分镜视频列」连线，便于 pickFrame 与引擎解析 */
export function repairStoryVideoFrameEdges(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] {
  const next = [...edges];
  for (const video of nodes) {
    if (!isAnyStoryVideoColumnType(video.type ?? "")) {
      continue;
    }
    const frameId = pickFrameColumnIdForVideoNode(
      nodes,
      next,
      video.id,
      findWorkspaceForColumnId(nodes, next, video.id),
    );
    if (!frameId) continue;
    const hasEdge = next.some(
      (e) => e.source === frameId && e.target === video.id,
    );
    if (hasEdge) continue;
    next.push({
      id: `e-repair-frame-${frameId}-${video.id}`,
      source: frameId,
      target: video.id,
    });
  }
  return next;
}

/** 加载/规范化：把所有分镜视频列 rows 与对齐的分镜脚本列写回 node.data */
export function reconcileStoryVideoColumnRows(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (!isAnyStoryVideoColumnType(n.type ?? "")) {
      return n;
    }
    const { frameColumnId, frameRows } = frameRowsForVideoColumn(
      nodes,
      edges,
      n.id,
    );
    if (!frameColumnId || !frameRows.length) return n;
    const stored = (n.data as { rows?: StoryVideoRow[] })?.rows ?? [];
    const patched = patchVideoRowsFromFrameRows(stored, frameRows);
    const sameLen = patched.length === stored.length;
    const sameKeys =
      sameLen && patched.every((r, i) => r.key === stored[i]?.key);
    const sameFrame = (n.data as { frameColumnId?: string }).frameColumnId === frameColumnId;
    if (sameLen && sameKeys && sameFrame) return n;
    return {
      ...n,
      data: {
        ...n.data,
        rows: patched,
        frameColumnId,
        /** 镜数变多时须重新按行数撑高，否则壳内 overflow:hidden 只露出前几镜 */
        manualSize: false,
      },
    };
  });
}

/** hydrate / strip 之后：修边 + 补齐视频行 + 列高 */
export function finalizeStoryMediaGraph(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const repairedEdges = repairStoryVideoFrameEdges(nodes, edges);
  let synced = reconcileStoryVideoColumnRows(nodes, repairedEdges);
  synced = synced.map((n) => {
    if (n.type !== "story-video-column" && n.type !== "story-pro-video") {
      return n;
    }
    return { ...n, data: { ...n.data, manualSize: false } };
  });
  return { nodes: synced, edges: repairedEdges };
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
