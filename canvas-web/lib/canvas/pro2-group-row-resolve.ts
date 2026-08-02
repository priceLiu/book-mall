import type { CanvasFlowNode } from "./types";

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
