"use client";

import type { StoryProCharacterRow } from "./story-pro-workspace-types";
import { buildPro2ThreeViewNodeData } from "./pro2-spawn-nodes";
import { buildPro2ThreeViewDockPrompt } from "./three-view-prompt-rules";
import {
  readHubVisualStylePack,
  type StoryProVisualStylePack,
} from "./story-pro-visual-style-pack";
import {
  pro2MediaChildSize,
  pro2MediaGridLayout,
  pro2MediaGridCols,
  pro2MediaGroupOrigin,
  relayoutPro2MediaGroup,
} from "./pro2-media-group-layout";
import {
  ensurePro2HubToMediaGroupChildEdges,
} from "./pro2-hub-media-group-edge";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { GROUP_COLOR_PRESETS } from "./types";
import {
  findPro2CharacterThreeViewNodeForRow,
  clearOrphanPro2ThreeViewInflightInGroup,
  reconcilePro2ThreeViewNodesWithColumnRows,
  resolveCharacterSyncGroupId,
  characterRowsNeedingThreeViewNodeSync,
} from "./pro2-group-row-resolve";
import { filterPro2RowsForSpawn } from "./pro2-media-row-spawn";
import { hubDataForColumnSync } from "./story-hub-runtime";
import { syncStoryProColumnRows } from "./story-pro-column-sync";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import { isAnyStoryCharacterColumnType } from "./story-workspace-resolver";

export function findPro2CharacterColumnForHub(
  nodes: CanvasFlowNode[],
  hubId: string,
): CanvasFlowNode | undefined {
  return nodes.find(
    (n) =>
      isAnyStoryCharacterColumnType(n.type ?? "") &&
      (n.data as { hubNodeId?: string }).hubNodeId === hubId,
  );
}

/**
 * 剧本 hub 角色表变更 → 刷新角色列表字段 + 已有三视图节点 dock（从表字段即时组装，不写 row.prompt）
 */
export function syncPro2CharacterColumnAndThreeViewDocksFromHub(
  nodes: CanvasFlowNode[],
  hubId: string,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  hubDataOverride?: StoryProScriptHubNodeData,
): boolean {
  const hub = nodes.find((n) => n.id === hubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return false;
  const characterColumn = findPro2CharacterColumnForHub(nodes, hubId);
  if (!characterColumn) return false;

  const hubData = hubDataOverride ??
    (hubDataForColumnSync(
      hub.data as Parameters<typeof hubDataForColumnSync>[0],
    ) as StoryProScriptHubNodeData);
  const existing = (
    characterColumn.data as { rows?: StoryProCharacterRow[] }
  ).rows;
  const synced = syncStoryProColumnRows(
    hubData,
    { characterRows: existing },
    hubId,
  );
  updateNodeData(characterColumn.id, {
    rows: synced.characterRows,
    hubNodeId: hubId,
  });
  const nodesAfter = nodes.map((n) =>
    n.id === characterColumn.id
      ? { ...n, data: { ...n.data, rows: synced.characterRows } }
      : n,
  );
  syncPro2CharacterImagesFromRows(
    nodesAfter,
    characterColumn.id,
    synced.characterRows,
    updateNodeData,
    { hubNodeId: hubId },
  );
  return true;
}

function characterRowPreview(row: StoryProCharacterRow): {
  ossUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  runtime?: CanvasNodeRuntime;
} {
  const rt = row.runtime;
  const url =
    pickRuntimeImagePreviewUrl(rt, undefined) ||
    rt?.ossUrl ||
    rt?.ephemeralUrl;
  const uploading =
    rt?.status === "running" ||
    rt?.status === "pending" ||
    rt?.status === "queued";
  return {
    ossUrl: url,
    uploading,
    uploadError: rt?.failMessage,
    runtime: rt
      ? {
          status: rt.status,
          taskId: rt.taskId,
          ossUrl: rt.ossUrl,
          ephemeralUrl: rt.ephemeralUrl,
          failCode: rt.failCode,
          failMessage: rt.failMessage,
        }
      : undefined,
  };
}

/** 同步到组内三视图节点：避免 undefined 覆盖已有 ossUrl */
export function buildCharacterImageNodeDataPatch(
  row: StoryProCharacterRow,
  opts?: {
    visualStylePack?: StoryProVisualStylePack | null;
    hubNodeId?: string;
    nodes?: CanvasFlowNode[];
    /** 新组抽卡：不继承列上旧图 / runtime，避免「已生成 + 多路生成中」混在同一组 */
    freshSpawn?: boolean;
  },
): Record<string, unknown> {
  const preview = characterRowPreview(row);
  const pack =
    opts?.visualStylePack ??
    (opts?.hubNodeId && opts?.nodes
      ? readHubVisualStylePack(opts.hubNodeId, opts.nodes)
      : null);
  const dockInput = buildPro2ThreeViewDockPrompt(row, pack);
  const patch: Record<string, unknown> = {
    label: row.name?.trim() || "角色",
    dockInput,
    pro2RowKey: row.key,
    uploading: opts?.freshSpawn ? false : Boolean(preview.uploading),
  };
  if (!opts?.freshSpawn && preview.ossUrl) {
    patch.ossUrl = preview.ossUrl;
    patch.blobUrl = undefined;
  } else if (opts?.freshSpawn) {
    patch.ossUrl = undefined;
    patch.blobUrl = undefined;
  }
  if (!opts?.freshSpawn && preview.uploadError?.trim()) {
    patch.uploadError = preview.uploadError;
  } else if (opts?.freshSpawn || !preview.uploading) {
    patch.uploadError = undefined;
  }
  if (!opts?.freshSpawn && preview.runtime) {
    patch.runtime = preview.runtime;
  } else if (opts?.freshSpawn || !preview.uploading) {
    patch.runtime = undefined;
  }
  return patch;
}

/** 批量/轮询同步 · 仅更新 runtime / 预览，不覆盖用户已编辑的 dockInput */
export function buildCharacterImageNodeInflightPatch(
  row: StoryProCharacterRow,
): Record<string, unknown> {
  const preview = characterRowPreview(row);
  const patch: Record<string, unknown> = {
    uploading: Boolean(preview.uploading),
  };
  if (preview.ossUrl) {
    patch.ossUrl = preview.ossUrl;
    patch.blobUrl = undefined;
  }
  if (preview.uploading || isThreeViewRowInflight(preview.runtime)) {
    patch.uploadError = undefined;
  } else if (preview.uploadError?.trim()) {
    patch.uploadError = preview.uploadError;
  } else {
    patch.uploadError = undefined;
  }
  if (preview.runtime) {
    patch.runtime = preview.runtime;
  } else if (!preview.uploading) {
    patch.runtime = undefined;
  }
  return patch;
}

function characterImagePatchOpts(
  hubNodeId: string | undefined,
  nodes: CanvasFlowNode[],
): { hubNodeId?: string; nodes?: CanvasFlowNode[] } {
  return hubNodeId ? { hubNodeId, nodes } : { nodes };
}

const THREE_VIEW_BATCH_PENDING: CanvasNodeRuntime = {
  status: "pending",
};

function isThreeViewRowInflight(rt?: CanvasNodeRuntime): boolean {
  const s = rt?.status;
  return s === "pending" || s === "running" || s === "queued";
}

/** @deprecated 使用 clearOrphanPro2ThreeViewInflightInGroup */
export function clearStalePro2ThreeViewInflight(
  characterColumnId: string,
  activeRowKeys: string[],
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  clearOrphanPro2ThreeViewInflightInGroup(
    characterColumnId,
    activeRowKeys,
    nodes,
    updateNodeData,
  );
}

/** 批量三视图 · 入队前立刻标记全部角色行 + 组内节点为生成中（并发跑图） */
export function optimisticPro2ThreeViewBatchStart(
  characterColumnId: string,
  rowKeys: string[],
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const allowed = new Set(rowKeys.filter(Boolean));
  if (!allowed.size) return;
  const col = nodes.find((n) => n.id === characterColumnId);
  if (!col) return;
  const rows = (col.data as { rows?: StoryProCharacterRow[] }).rows ?? [];
  const nextRows = rows.map((r) =>
    allowed.has(r.key) ? { ...r, runtime: THREE_VIEW_BATCH_PENDING } : r,
  );
  updateNodeData(characterColumnId, { rows: nextRows });
  const syncedNodes = nodes.map((n) =>
    n.id === characterColumnId
      ? { ...n, data: { ...n.data, rows: nextRows } }
      : n,
  );
  syncPro2CharacterImagesFromRows(
    syncedNodes,
    characterColumnId,
    nextRows.filter((r) => allowed.has(r.key)),
    updateNodeData,
    { inflightOnly: true },
  );
}

function groupLabel(
  hubNodeId: string,
  nodes: CanvasFlowNode[],
  spawnNewGroup?: boolean,
): string {
  const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
  const idx = hubs.findIndex((h) => h.id === hubNodeId);
  const base = `三视图 · 脚本 ${idx >= 0 ? idx + 1 : 1}`;
  if (!spawnNewGroup) return base;
  const existing = nodes.filter(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2Kind?: string; pro2HubNodeId?: string }).pro2Kind ===
        "character-board" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === hubNodeId,
  ).length;
  return existing > 0 ? `${base} (${existing + 1})` : base;
}

function isCharacterThreeViewChild(n: CanvasFlowNode, controllerId: string): boolean {
  if (
    (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId !==
    controllerId
  ) {
    return false;
  }
  if (n.type === "story-pro2-three-view") return true;
  return (
    n.type === "story-pro2-image" &&
    (n.data as { pro2MediaRole?: string }).pro2MediaRole === "character-three-view"
  );
}

export type EnsurePro2CharacterImageGroupArgs = {
  characterColumnId: string;
  hubNodeId: string;
  rows: StoryProCharacterRow[];
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-three-view" | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "story-pro2-three-view",
    groupId: string,
    relativePosition: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  createGroupContaining: (
    childIds: string[],
    opts: { label: string; color: string },
  ) => string | null;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges?: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  /** 已有三视图组时追加新组（不覆盖旧组） */
  spawnNewGroup?: boolean;
  /** 仅 spawn 这些 rowKey 对应节点（hub 多选生成） */
  rowKeys?: string[];
};

export function ensurePro2CharacterImageGroup(
  args: EnsurePro2CharacterImageGroupArgs,
): string | null {
  const colNode = args.nodes.find((n) => n.id === args.characterColumnId);
  if (!colNode) return null;

  const spawnNew = Boolean(args.spawnNewGroup);

  let existingGroup = spawnNew
    ? undefined
    : args.nodes.find(
        (n) =>
          n.type === "group" &&
          (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
            args.characterColumnId,
      );
  if (!spawnNew && !existingGroup) {
    const colData = colNode.data as { pro2VisualGroupId?: string };
    if (colData.pro2VisualGroupId) {
      existingGroup = args.nodes.find((n) => n.id === colData.pro2VisualGroupId);
    }
  }
  if (existingGroup) {
    const gd = existingGroup.data as {
      pro2Kind?: string;
      pro2ControllerNodeId?: string;
      pro2HubNodeId?: string;
    };
    if (
      gd.pro2Kind !== "character-board" ||
      !gd.pro2ControllerNodeId ||
      !gd.pro2HubNodeId
    ) {
      args.updateNodeData(existingGroup.id, {
        pro2Kind: "character-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.characterColumnId,
        label: groupLabel(args.hubNodeId, args.nodes, spawnNew),
      });
    }
  }

  const spawnRows = filterPro2RowsForSpawn(args.rows, args.rowKeys);
  const sorted = [...spawnRows].sort((a, b) =>
    a.name.localeCompare(b.name, "zh"),
  );
  if (!sorted.length) {
    if (existingGroup?.id && args.setEdges) {
      const childIds = args.nodes
        .filter(
          (n) =>
            isCharacterThreeViewChild(n, args.characterColumnId) &&
            n.parentId === existingGroup.id,
        )
        .map((n) => n.id);
      ensurePro2HubToMediaGroupChildEdges(
        args.setEdges,
        args.hubNodeId,
        existingGroup.id,
        childIds,
      );
    }
    return existingGroup?.id ?? null;
  }

  const origin = pro2MediaGroupOrigin(args.nodes, args.hubNodeId);
  let groupId = existingGroup?.id;

  /** 抽卡：先建空组 + 立刻标记 pending，再 addNodeInGroup，避免 relayout 把节点吸进旧组 */
  if (spawnNew && !groupId) {
    const shellId = args.addNode("group", origin, {
      __t: "group",
      label: groupLabel(args.hubNodeId, args.nodes, true),
      color: GROUP_COLOR_PRESETS[2],
      pro2Kind: "character-board",
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.characterColumnId,
    });
    if (shellId) {
      groupId = shellId;
      args.updateNodeData(args.characterColumnId, {
        pro2PendingSyncGroupId: groupId,
        hubNodeId: args.hubNodeId,
      });
    }
  }

  const childNodes = spawnNew
    ? []
    : args.nodes.filter((n) =>
        isCharacterThreeViewChild(n, args.characterColumnId),
      );
  const patchOpts = {
    ...characterImagePatchOpts(args.hubNodeId, args.nodes),
    freshSpawn: spawnNew,
  };

  const newChildIds: string[] = [];
  const cellSize = pro2MediaChildSize({ type: "story-pro2-three-view" });
  const cols = pro2MediaGridCols(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const label = row.name?.trim() || `角色 ${i + 1}`;
    const existing = spawnNew
      ? undefined
      : childNodes.find(
          (n) => (n.data as { pro2RowKey?: string }).pro2RowKey === row.key,
        );

    if (existing) {
      args.updateNodeData(existing.id, {
        ...buildCharacterImageNodeDataPatch(row, patchOpts),
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.characterColumnId,
        pro2GroupId: groupId,
      });
      newChildIds.push(existing.id);
      continue;
    }

    const rel = pro2MediaGridLayout(i, cellSize, cols);
    const data = {
      ...buildPro2ThreeViewNodeData({ label }),
      ...buildCharacterImageNodeDataPatch(row, patchOpts),
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.characterColumnId,
      pro2GroupId: groupId,
    };

    if (groupId) {
      const id = args.addNodeInGroup("story-pro2-three-view", groupId, rel, data);
      if (id) newChildIds.push(id);
    } else {
      const abs = { x: origin.x + rel.x, y: origin.y + rel.y };
      const id = args.addNode("story-pro2-three-view", abs, data);
      if (id) newChildIds.push(id);
    }
  }

  if (!newChildIds.length) {
    if (spawnNew && groupId) {
      args.setNodes((prev) => prev.filter((n) => n.id !== groupId));
      args.updateNodeData(args.characterColumnId, {
        pro2PendingSyncGroupId: undefined,
      });
    }
    return spawnNew ? null : groupId ?? null;
  }

  if (!groupId) {
    groupId =
      args.createGroupContaining(newChildIds, {
        label: groupLabel(args.hubNodeId, args.nodes, spawnNew),
        color: GROUP_COLOR_PRESETS[2],
      }) ?? undefined;
    if (groupId) {
      for (const cid of newChildIds) {
        args.updateNodeData(cid, { pro2GroupId: groupId });
      }
      args.updateNodeData(groupId, {
        pro2Kind: "character-board",
        pro2HubNodeId: args.hubNodeId,
        pro2ControllerNodeId: args.characterColumnId,
        label: groupLabel(args.hubNodeId, args.nodes, spawnNew),
      });
    }
  } else if (spawnNew) {
    args.updateNodeData(groupId, {
      pro2Kind: "character-board",
      pro2HubNodeId: args.hubNodeId,
      pro2ControllerNodeId: args.characterColumnId,
      label: groupLabel(args.hubNodeId, args.nodes, spawnNew),
    });
  }

  const colPatch: Record<string, unknown> = {
    hubNodeId: args.hubNodeId,
  };
  if (spawnNew && groupId) {
    colPatch.pro2PendingSyncGroupId = groupId;
  } else if (groupId) {
    colPatch.pro2VisualGroupId = groupId;
  }
  args.updateNodeData(args.characterColumnId, colPatch);

  args.setNodes((prev) =>
    prev.map((n) =>
      n.id === args.characterColumnId
        ? { ...n, selectable: false, focusable: false }
        : n,
    ),
  );

  if (groupId) {
    relayoutPro2MediaGroup(args.setNodes, groupId, { resetOrigin: true });
    if (args.setEdges) {
      ensurePro2HubToMediaGroupChildEdges(
        args.setEdges,
        args.hubNodeId,
        groupId,
        newChildIds,
      );
    }
  }

  return groupId ?? null;
}

export function syncPro2CharacterImagesFromRows(
  nodes: CanvasFlowNode[],
  characterColumnId: string,
  rows: StoryProCharacterRow[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  opts?: { inflightOnly?: boolean; hubNodeId?: string },
): void {
  const col = nodes.find((n) => n.id === characterColumnId);
  const hubNodeId =
    opts?.hubNodeId ??
    (col?.data as { hubNodeId?: string } | undefined)?.hubNodeId ??
    (
      nodes.find(
        (n) =>
          isCharacterThreeViewChild(n, characterColumnId) &&
          (n.data as { pro2HubNodeId?: string }).pro2HubNodeId,
      )?.data as { pro2HubNodeId?: string } | undefined
    )?.pro2HubNodeId;
  const patchOpts = characterImagePatchOpts(hubNodeId, nodes);

  for (const row of rows) {
    const img = findPro2CharacterThreeViewNodeForRow(
      nodes,
      characterColumnId,
      row.key,
    );
    if (!img) continue;
    updateNodeData(
      img.id,
      opts?.inflightOnly
        ? buildCharacterImageNodeInflightPatch(row)
        : buildCharacterImageNodeDataPatch(row, patchOpts),
    );
  }
}
