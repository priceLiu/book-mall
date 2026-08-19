import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import type { StoryProCharacterRow, StoryProFrameRow } from "./story-pro-workspace-types";
import { isSameSbv1MediaDataPatch } from "./sbv1-image-task-apply";

export function resolveCharacterSyncGroupId(
  nodes: CanvasFlowNode[],
  characterColumnId: string,
): string | undefined {
  const colNode = nodes.find((n) => n.id === characterColumnId);
  if (!colNode) return undefined;
  const d = colNode.data as {
    pro2PendingSyncGroupId?: string;
    pro2VisualGroupId?: string;
  };
  return d.pro2PendingSyncGroupId?.trim() || d.pro2VisualGroupId?.trim() || undefined;
}

function isCharacterThreeViewChild(
  n: CanvasFlowNode,
  controllerId: string,
): boolean {
  if (
    (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId !==
    controllerId
  ) {
    return false;
  }
  if (n.type === "story-pro2-three-view") return true;
  return (
    n.type === "story-pro2-image" &&
    (n.data as { pro2MediaRole?: string }).pro2MediaRole ===
      "character-three-view"
  );
}

function applyMediaNodePatchIfChanged(
  node: CanvasFlowNode,
  patch: Record<string, unknown>,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  if (
    isSameSbv1MediaDataPatch(node.data as Record<string, unknown>, patch)
  ) {
    return;
  }
  updateNodeData(node.id, patch);
}

function isThreeViewRowInflight(rt?: CanvasNodeRuntime): boolean {
  const s = rt?.status;
  return s === "pending" || s === "running" || s === "queued";
}

/** Dock 单格再生成 · 将 pending sync 指向当前三视图所在组（否则扫光/sync 会落到旧组） */
export function scopePro2CharacterSyncGroupForThreeViewNode(
  characterColumnId: string,
  threeViewNodeId: string,
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): string | undefined {
  const tv = nodes.find((n) => n.id === threeViewNodeId);
  if (!tv) return undefined;
  const groupId =
    tv.parentId?.trim() ||
    (tv.data as { pro2GroupId?: string }).pro2GroupId?.trim();
  if (!groupId) return undefined;
  updateNodeData(characterColumnId, { pro2PendingSyncGroupId: groupId });
  return groupId;
}

/** 单格/批量再生成前：仅清组内「节点扫光但列行已非 in-flight」残留，不取消其它角色行 */
export function clearOrphanPro2ThreeViewInflightInGroup(
  characterColumnId: string,
  activeRowKeys: string[],
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const allowed = new Set(activeRowKeys.filter(Boolean));
  const col = nodes.find((n) => n.id === characterColumnId);
  if (!col) return;
  const rows = (col.data as { rows?: StoryProCharacterRow[] }).rows ?? [];
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const syncGroupId = resolveCharacterSyncGroupId(nodes, characterColumnId);
  if (!syncGroupId) return;

  for (const n of nodes) {
    if (!isCharacterThreeViewChild(n, characterColumnId)) continue;
    const groupId =
      n.parentId?.trim() ||
      (n.data as { pro2GroupId?: string }).pro2GroupId?.trim();
    if (groupId !== syncGroupId) continue;
    const rowKey = (n.data as { pro2RowKey?: string }).pro2RowKey?.trim();
    if (!rowKey || allowed.has(rowKey)) continue;

    const row = rowByKey.get(rowKey);
    const nodeData = n.data as {
      uploading?: boolean;
      runtime?: CanvasNodeRuntime;
    };
    const rowInflight = isThreeViewRowInflight(row?.runtime);
    const nodeInflight =
      Boolean(nodeData.uploading) ||
      isThreeViewRowInflight(nodeData.runtime);
    if (!nodeInflight || rowInflight) continue;

    updateNodeData(n.id, {
      uploading: false,
      runtime: undefined,
      uploadError: undefined,
    });
  }
}

function threeViewNodeSyncPatchFromRow(
  row: StoryProCharacterRow,
): Record<string, unknown> {
  const rt = row.runtime;
  const url = rt?.ossUrl?.trim() || rt?.ephemeralUrl?.trim();
  const uploading =
    rt?.status === "running" ||
    rt?.status === "pending" ||
    rt?.status === "queued";
  const patch: Record<string, unknown> = {
    uploading,
  };
  if (url) {
    patch.ossUrl = url;
    patch.blobUrl = undefined;
  }
  if (uploading || isThreeViewRowInflight(rt)) {
    patch.uploadError = undefined;
  } else if (rt?.failMessage?.trim()) {
    patch.uploadError = rt.failMessage;
  } else {
    patch.uploadError = undefined;
  }
  if (rt) {
    patch.runtime = {
      status: rt.status,
      taskId: rt.taskId,
      ossUrl: rt.ossUrl,
      ephemeralUrl: rt.ephemeralUrl,
      failCode: rt.failCode,
      failMessage: rt.failMessage,
    };
  } else if (!uploading) {
    patch.runtime = undefined;
  }
  return patch;
}

function characterThreeViewNodesForRow(
  nodes: CanvasFlowNode[],
  characterColumnId: string,
  rowKey: string,
): CanvasFlowNode[] {
  return nodes.filter((n) => {
    if (!isCharacterThreeViewChild(n, characterColumnId)) return false;
    return (n.data as { pro2RowKey?: string }).pro2RowKey === rowKey;
  });
}

function characterBoardGroupIds(nodes: CanvasFlowNode[]): Set<string> {
  return new Set(
    nodes
      .filter(
        (n) =>
          n.type === "group" &&
          (n.data as { pro2Kind?: string }).pro2Kind === "character-board",
      )
      .map((n) => n.id),
  );
}

function threeViewNodeGroupId(n: CanvasFlowNode): string | undefined {
  return (
    n.parentId?.trim() ||
    (n.data as { pro2GroupId?: string }).pro2GroupId?.trim() ||
    undefined
  );
}

/** 角色列 rowKey → 组内三视图节点（多组抽卡时按 pending/visual 组定位） */
export function findPro2CharacterThreeViewNodeForRow(
  nodes: CanvasFlowNode[],
  characterColumnId: string,
  rowKey: string,
): CanvasFlowNode | undefined {
  const candidates = characterThreeViewNodesForRow(
    nodes,
    characterColumnId,
    rowKey,
  );
  if (!candidates.length) return undefined;

  const syncGroupId = resolveCharacterSyncGroupId(nodes, characterColumnId);
  if (syncGroupId) {
    const inSync = candidates.find(
      (n) => threeViewNodeGroupId(n) === syncGroupId,
    );
    if (inSync) return inSync;
  }

  const validGroups = characterBoardGroupIds(nodes);
  const syncGroupStale =
    Boolean(syncGroupId) && !validGroups.has(syncGroupId!);
  if (!syncGroupId || syncGroupStale) {
    const inValidGroups = candidates.filter((n) => {
      const gid = threeViewNodeGroupId(n);
      return gid && validGroups.has(gid);
    });
    if (inValidGroups.length === 1) return inValidGroups[0];
    const pendingId = (
      nodes.find((n) => n.id === characterColumnId)?.data as {
        pro2PendingSyncGroupId?: string;
      }
    )?.pro2PendingSyncGroupId?.trim();
    if (pendingId) {
      const inPending = inValidGroups.find(
        (n) => threeViewNodeGroupId(n) === pendingId,
      );
      if (inPending) return inPending;
    }
    const inflight = inValidGroups.find((n) => {
      const d = n.data as {
        uploading?: boolean;
        runtime?: CanvasNodeRuntime;
        ossUrl?: string;
      };
      return (
        d.uploading ||
        isThreeViewRowInflight(d.runtime) ||
        !d.ossUrl?.trim()
      );
    });
    if (inflight) return inflight;
    if (inValidGroups.length) return inValidGroups[inValidGroups.length - 1];
  }

  return candidates[0];
}

/** 批量再生成 · 清掉其它组内同 rowKey 三视图的残留扫光（避免旧组误显示生成中） */
export function clearPro2ThreeViewInflightOutsideSyncGroup(
  characterColumnId: string,
  rowKeys: string[],
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const allowed = new Set(rowKeys.filter(Boolean));
  if (!allowed.size) return;
  const syncGroupId = resolveCharacterSyncGroupId(nodes, characterColumnId);
  if (!syncGroupId) return;

  for (const n of nodes) {
    if (!isCharacterThreeViewChild(n, characterColumnId)) continue;
    const rowKey = (n.data as { pro2RowKey?: string }).pro2RowKey?.trim();
    if (!rowKey || !allowed.has(rowKey)) continue;
    const groupId =
      n.parentId?.trim() ||
      (n.data as { pro2GroupId?: string }).pro2GroupId?.trim();
    if (!groupId || groupId === syncGroupId) continue;
    const nodeData = n.data as {
      uploading?: boolean;
      runtime?: CanvasNodeRuntime;
    };
    if (
      !nodeData.uploading &&
      !isThreeViewRowInflight(nodeData.runtime)
    ) {
      continue;
    }
    updateNodeData(n.id, {
      uploading: false,
      runtime: undefined,
      uploadError: undefined,
    });
  }
}

/** 轮询 · 列上已无 in-flight 时，清掉三视图节点残留扫光（保留行级 error / done 预览） */
export function reconcilePro2ThreeViewNodesWithColumnRows(
  nodes: CanvasFlowNode[],
  characterColumnId: string,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const col = nodes.find((n) => n.id === characterColumnId);
  if (!col) return;
  const rows = (col.data as { rows?: StoryProCharacterRow[] }).rows ?? [];
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const inflightKeys = new Set(
    rows
      .filter((r) => isThreeViewRowInflight(r.runtime))
      .map((r) => r.key),
  );
  const syncGroupId = resolveCharacterSyncGroupId(nodes, characterColumnId);

  for (const n of nodes) {
    if (
      (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId !==
      characterColumnId
    ) {
      continue;
    }
    if (n.type !== "story-pro2-three-view") {
      if (
        n.type === "story-pro2-image" &&
        (n.data as { pro2MediaRole?: string }).pro2MediaRole ===
          "character-three-view"
      ) {
        // fall through
      } else {
        continue;
      }
    }
    const rowKey = (n.data as { pro2RowKey?: string }).pro2RowKey?.trim();
    if (!rowKey) continue;

    const groupId =
      n.parentId?.trim() ||
      (n.data as { pro2GroupId?: string }).pro2GroupId?.trim();
    const row = rowByKey.get(rowKey);
    const inSyncGroup = !syncGroupId || groupId === syncGroupId;

    if (inflightKeys.has(rowKey) && syncGroupId && groupId && groupId !== syncGroupId) {
      const nodeData = n.data as {
        uploading?: boolean;
        runtime?: CanvasNodeRuntime;
      };
      if (
        nodeData.uploading ||
        isThreeViewRowInflight(nodeData.runtime)
      ) {
        updateNodeData(n.id, {
          uploading: false,
          runtime: undefined,
          uploadError: undefined,
        });
      }
      continue;
    }

    if (inflightKeys.has(rowKey)) continue;

    if (
      row?.runtime?.status === "error" ||
      row?.runtime?.status === "done"
    ) {
      const syncTarget = findPro2CharacterThreeViewNodeForRow(
        nodes,
        characterColumnId,
        rowKey,
      );
      if (syncTarget && syncTarget.id === n.id) {
        applyMediaNodePatchIfChanged(
          n,
          threeViewNodeSyncPatchFromRow(row),
          updateNodeData,
        );
        continue;
      }
      if (inSyncGroup) {
        applyMediaNodePatchIfChanged(
          n,
          threeViewNodeSyncPatchFromRow(row),
          updateNodeData,
        );
        continue;
      }
    }

    const nodeData = n.data as {
      uploading?: boolean;
      runtime?: CanvasNodeRuntime;
    };
    if (
      !nodeData.uploading &&
      !isThreeViewRowInflight(nodeData.runtime)
    ) {
      continue;
    }
    updateNodeData(n.id, {
      uploading: false,
      runtime: undefined,
      uploadError: undefined,
    });
  }
}

export function resolveFrameSyncGroupId(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
): string | undefined {
  const frameNode = nodes.find((n) => n.id === frameColumnId);
  if (!frameNode) return undefined;
  const d = frameNode.data as {
    pro2PendingSyncGroupId?: string;
    pro2VisualGroupId?: string;
  };
  return d.pro2PendingSyncGroupId?.trim() || d.pro2VisualGroupId?.trim() || undefined;
}

function isFrameImageChild(n: CanvasFlowNode, controllerId: string): boolean {
  return (
    n.type === "story-pro2-image" &&
    (n.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
      controllerId &&
    (n.data as { pro2MediaRole?: string }).pro2MediaRole === "frame"
  );
}

function isFrameRowInflight(rt?: CanvasNodeRuntime): boolean {
  const s = rt?.status;
  return s === "pending" || s === "running" || s === "queued";
}

function frameBoardGroupIds(nodes: CanvasFlowNode[]): Set<string> {
  return new Set(
    nodes
      .filter(
        (n) =>
          n.type === "group" &&
          (n.data as { pro2Kind?: string }).pro2Kind === "frame-board",
      )
      .map((n) => n.id),
  );
}

function frameImageNodesForRow(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  rowKey: string,
): CanvasFlowNode[] {
  return nodes.filter((n) => {
    if (!isFrameImageChild(n, frameColumnId)) return false;
    return (n.data as { pro2RowKey?: string }).pro2RowKey === rowKey;
  });
}

function frameImageNodeGroupId(n: CanvasFlowNode): string | undefined {
  return (
    n.parentId?.trim() ||
    (n.data as { pro2GroupId?: string }).pro2GroupId?.trim() ||
    undefined
  );
}

function frameNodeSyncPatchFromRow(
  row: StoryProFrameRow,
): Record<string, unknown> {
  const rt = row.runtime;
  const url = rt?.ossUrl?.trim() || rt?.ephemeralUrl?.trim();
  const uploading =
    rt?.status === "running" ||
    rt?.status === "pending" ||
    rt?.status === "queued";
  const patch: Record<string, unknown> = {
    uploading,
  };
  if (url) {
    patch.ossUrl = url;
    patch.blobUrl = undefined;
  }
  if (uploading || isFrameRowInflight(rt)) {
    patch.uploadError = undefined;
  } else if (rt?.failMessage?.trim()) {
    patch.uploadError = rt.failMessage;
  } else {
    patch.uploadError = undefined;
  }
  if (rt) {
    patch.runtime = {
      status: rt.status,
      taskId: rt.taskId,
      ossUrl: rt.ossUrl,
      ephemeralUrl: rt.ephemeralUrl,
      failCode: rt.failCode,
      failMessage: rt.failMessage,
    };
  } else if (!uploading) {
    patch.runtime = undefined;
  }
  return patch;
}

/** 分镜列 + rowKey → 组内图片节点（多组抽卡时按 pending/visual 组定位） */
export function findPro2FrameImageNodeForRow(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  rowKey: string,
): CanvasFlowNode | undefined {
  const candidates = frameImageNodesForRow(nodes, frameColumnId, rowKey);
  if (!candidates.length) return undefined;

  const syncGroupId = resolveFrameSyncGroupId(nodes, frameColumnId);
  if (syncGroupId) {
    const inSync = candidates.find(
      (n) => frameImageNodeGroupId(n) === syncGroupId,
    );
    if (inSync) return inSync;
  }

  const validGroups = frameBoardGroupIds(nodes);
  const syncGroupStale =
    Boolean(syncGroupId) && !validGroups.has(syncGroupId!);
  if (!syncGroupId || syncGroupStale) {
    const inValidGroups = candidates.filter((n) => {
      const gid = frameImageNodeGroupId(n);
      return gid && validGroups.has(gid);
    });
    if (inValidGroups.length === 1) return inValidGroups[0];
    const pendingId = (
      nodes.find((n) => n.id === frameColumnId)?.data as {
        pro2PendingSyncGroupId?: string;
      }
    )?.pro2PendingSyncGroupId?.trim();
    if (pendingId) {
      const inPending = inValidGroups.find(
        (n) => frameImageNodeGroupId(n) === pendingId,
      );
      if (inPending) return inPending;
    }
    const inflight = inValidGroups.find((n) => {
      const d = n.data as {
        uploading?: boolean;
        runtime?: CanvasNodeRuntime;
        ossUrl?: string;
      };
      return (
        d.uploading ||
        isFrameRowInflight(d.runtime) ||
        !d.ossUrl?.trim()
      );
    });
    if (inflight) return inflight;
    if (inValidGroups.length) return inValidGroups[inValidGroups.length - 1];
  }

  return candidates[0];
}

/** 批量再生成 · 清掉其它组内同 rowKey 分镜格的残留扫光 */
export function clearPro2FrameInflightOutsideSyncGroup(
  frameColumnId: string,
  rowKeys: string[],
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const allowed = new Set(rowKeys.filter(Boolean));
  if (!allowed.size) return;
  const syncGroupId = resolveFrameSyncGroupId(nodes, frameColumnId);
  if (!syncGroupId) return;

  for (const n of nodes) {
    if (!isFrameImageChild(n, frameColumnId)) continue;
    const rowKey = (n.data as { pro2RowKey?: string }).pro2RowKey?.trim();
    if (!rowKey || !allowed.has(rowKey)) continue;
    const groupId = frameImageNodeGroupId(n);
    if (!groupId || groupId === syncGroupId) continue;
    const nodeData = n.data as {
      uploading?: boolean;
      runtime?: CanvasNodeRuntime;
    };
    if (!nodeData.uploading && !isFrameRowInflight(nodeData.runtime)) {
      continue;
    }
    updateNodeData(n.id, {
      uploading: false,
      runtime: undefined,
      uploadError: undefined,
    });
  }
}

/** 轮询 · 列上已无 in-flight 时，同步分镜格并清掉残留扫光 */
export function reconcilePro2FrameNodesWithColumnRows(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const col = nodes.find((n) => n.id === frameColumnId);
  if (!col) return;
  const rows = (col.data as { rows?: StoryProFrameRow[] }).rows ?? [];
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const inflightKeys = new Set(
    rows.filter((r) => isFrameRowInflight(r.runtime)).map((r) => r.key),
  );
  const syncGroupId = resolveFrameSyncGroupId(nodes, frameColumnId);

  for (const n of nodes) {
    if (!isFrameImageChild(n, frameColumnId)) continue;
    const rowKey = (n.data as { pro2RowKey?: string }).pro2RowKey?.trim();
    if (!rowKey) continue;

    const groupId = frameImageNodeGroupId(n);
    const row = rowByKey.get(rowKey);
    const inSyncGroup = !syncGroupId || groupId === syncGroupId;

    if (inflightKeys.has(rowKey) && syncGroupId && groupId && groupId !== syncGroupId) {
      const nodeData = n.data as {
        uploading?: boolean;
        runtime?: CanvasNodeRuntime;
      };
      if (nodeData.uploading || isFrameRowInflight(nodeData.runtime)) {
        updateNodeData(n.id, {
          uploading: false,
          runtime: undefined,
          uploadError: undefined,
        });
      }
      continue;
    }

    if (inflightKeys.has(rowKey)) continue;

    if (
      row?.runtime?.status === "error" ||
      row?.runtime?.status === "done"
    ) {
      const syncTarget = findPro2FrameImageNodeForRow(
        nodes,
        frameColumnId,
        rowKey,
      );
      if (syncTarget && syncTarget.id === n.id) {
        applyMediaNodePatchIfChanged(
          n,
          frameNodeSyncPatchFromRow(row),
          updateNodeData,
        );
        continue;
      }
      if (inSyncGroup) {
        applyMediaNodePatchIfChanged(
          n,
          frameNodeSyncPatchFromRow(row),
          updateNodeData,
        );
        continue;
      }
    }

    const nodeData = n.data as {
      uploading?: boolean;
      runtime?: CanvasNodeRuntime;
    };
    if (!nodeData.uploading && !isFrameRowInflight(nodeData.runtime)) {
      continue;
    }
    updateNodeData(n.id, {
      uploading: false,
      runtime: undefined,
      uploadError: undefined,
    });
  }
}

/** 场景图组批量完成后清除 hub 上的 pending sync 组 id */
export function maybeClearHubPendingSceneSyncGroup(
  nodes: CanvasFlowNode[],
  completedImageNodeId: string,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const node = nodes.find((n) => n.id === completedImageNodeId);
  if (!node || node.type !== "story-pro2-image") return;
  const d = node.data as {
    pro2MediaRole?: string;
    pro2HubNodeId?: string;
    pro2GroupId?: string;
    parentId?: string;
  };
  if (d.pro2MediaRole !== "scene" || !d.pro2HubNodeId?.trim()) return;
  const hub = nodes.find((n) => n.id === d.pro2HubNodeId);
  if (!hub) return;
  const pendingId = (
    hub.data as { pro2PendingSyncSceneGroupId?: string }
  ).pro2PendingSyncSceneGroupId?.trim();
  const nodeGroupId = d.pro2GroupId?.trim() || node.parentId?.trim();
  if (!pendingId || !nodeGroupId || pendingId !== nodeGroupId) return;

  const anyInflight = nodes.some((n) => {
    if (n.type !== "story-pro2-image") return false;
    const nd = n.data as {
      pro2MediaRole?: string;
      runtime?: { status?: string };
      pro2GroupId?: string;
    };
    if (nd.pro2MediaRole !== "scene") return false;
    if (
      n.parentId !== pendingId &&
      nd.pro2GroupId !== pendingId
    ) {
      return false;
    }
    const st = nd.runtime?.status;
    return st === "pending" || st === "running";
  });
  if (!anyInflight) {
    updateNodeData(hub.id, { pro2PendingSyncSceneGroupId: undefined });
  }
}

export function frameRowsNeedingImageNodeSync(
  rows: StoryProFrameRow[],
): StoryProFrameRow[] {
  return rows.filter((r) => {
    const s = r.runtime?.status;
    return (
      s === "pending" ||
      s === "running" ||
      s === "queued" ||
      s === "error" ||
      s === "done"
    );
  });
}

/** 角色列行有 runtime 时须同步到组内三视图节点（轮询增量 sync） */
export function characterRowsNeedingThreeViewNodeSync(
  rows: StoryProCharacterRow[],
): StoryProCharacterRow[] {
  return rows.filter((r) => {
    const s = r.runtime?.status;
    return (
      s === "pending" ||
      s === "running" ||
      s === "queued" ||
      s === "error" ||
      s === "done"
    );
  });
}
