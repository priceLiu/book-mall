import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import type { StoryProCharacterRow } from "./story-pro-workspace-types";

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

/** 角色列 rowKey → 组内三视图节点（多组抽卡时按 pending/visual 组定位） */
export function findPro2CharacterThreeViewNodeForRow(
  nodes: CanvasFlowNode[],
  characterColumnId: string,
  rowKey: string,
): CanvasFlowNode | undefined {
  const syncGroupId = resolveCharacterSyncGroupId(nodes, characterColumnId);
  return nodes.find((n) => {
    if (!isCharacterThreeViewChild(n, characterColumnId)) return false;
    if ((n.data as { pro2RowKey?: string }).pro2RowKey !== rowKey) return false;
    if (!syncGroupId) return true;
    return (
      n.parentId === syncGroupId ||
      (n.data as { pro2GroupId?: string }).pro2GroupId === syncGroupId
    );
  });
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
    if (!rowKey || inflightKeys.has(rowKey)) continue;

    const groupId =
      n.parentId?.trim() ||
      (n.data as { pro2GroupId?: string }).pro2GroupId?.trim();
    const row = rowByKey.get(rowKey);
    const inSyncGroup = !syncGroupId || groupId === syncGroupId;

    if (
      inSyncGroup &&
      (row?.runtime?.status === "error" || row?.runtime?.status === "done")
    ) {
      updateNodeData(n.id, threeViewNodeSyncPatchFromRow(row));
      continue;
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

/** 分镜列 + rowKey → 组内图片节点 */
export function findPro2FrameImageNodeForRow(
  nodes: CanvasFlowNode[],
  frameColumnId: string,
  rowKey: string,
): CanvasFlowNode | undefined {
  const syncGroupId = resolveFrameSyncGroupId(nodes, frameColumnId);
  return nodes.find((n) => {
    if (n.type !== "story-pro2-image") return false;
    const d = n.data as {
      pro2ControllerNodeId?: string;
      pro2RowKey?: string;
      pro2GroupId?: string;
    };
    if (d.pro2ControllerNodeId !== frameColumnId) return false;
    if (d.pro2RowKey !== rowKey) return false;
    if (!syncGroupId) return true;
    return d.pro2GroupId === syncGroupId;
  });
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
