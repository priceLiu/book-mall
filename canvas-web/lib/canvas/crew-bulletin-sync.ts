import type { CrewBulletinAnchor } from "./crew-bulletin-context";
import { isCrewBulletinGraphMetaAnchor } from "./crew-bulletin-context";
import type { CanvasGraph } from "./types";
import type { CanvasFlowNode } from "./types";
import type { CrewBulletinState, CrewTaskStatus } from "./crew-bulletin-types";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

function nodeRuntimeGenerating(node: CanvasFlowNode | undefined): boolean {
  if (!node) return false;
  const data = (node.data ?? {}) as {
    uploading?: unknown;
    runtime?: {
      status?: string;
      ossUrl?: string;
      ephemeralUrl?: string;
    } | null;
  };
  const s = data.runtime?.status;
  const rt = data.runtime;
  if (s === "done" || s === "error" || s === "idle") return false;
  if (rt?.ossUrl?.trim() || rt?.ephemeralUrl?.trim()) return false;
  if (data.uploading) return true;
  return s === "running" || s === "pending";
}

/** 根据画布工作节点 runtime 同步公告条任务状态 */
export function syncCrewBulletinFromCanvasNodes(
  bulletin: CrewBulletinState,
  nodes: CanvasFlowNode[],
): CrewBulletinState {
  let changed = false;
  const tasks = bulletin.tasks.map((task) => {
    if (task.kind === "script") return task;

    if (task.canvasNodeId) {
      const workNode = nodes.find((n) => n.id === task.canvasNodeId);
      if (!workNode) {
        if (task.status === "unclaimed") return task;
        // 协作画布 · 远端已领取/完成但本地节点尚未同步时，保留公告条状态
        if (task.assigneeUserId || task.assigneeDisplayName) return task;
        changed = true;
        return {
          ...task,
          status: "unclaimed" as CrewTaskStatus,
          canvasNodeId: undefined,
          claimedAt: undefined,
          completedAt: undefined,
          assigneeUserId: undefined,
          assigneeDisplayName: undefined,
        };
      }

      const generating = nodeRuntimeGenerating(workNode);
      let nextStatus: CrewTaskStatus = task.status;
      if (generating) {
        nextStatus = "generating";
      } else if (task.status === "generating") {
        // 生成完成仍保持「参与制作」，须用户点「完成制作」才提交为 done
        nextStatus = "claimed";
      }

      if (nextStatus === task.status) return task;
      changed = true;
      return {
        ...task,
        status: nextStatus,
        completedAt:
          nextStatus === "done"
            ? task.completedAt ?? new Date().toISOString()
            : nextStatus === "claimed" && task.status === "generating"
              ? undefined
              : task.completedAt,
      };
    }

    return task;
  });

  if (!changed) return bulletin;
  return { ...bulletin, tasks };
}

export function patchHubCrewBulletin(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const bulletin = hubData.crewBulletin;
  if (!bulletin || !hubData.scriptPublished) return;
  const synced = syncCrewBulletinFromCanvasNodes(bulletin, nodes);
  if (synced === bulletin) return;
  updateNodeData(hubId, { crewBulletin: synced });
}

/** 同步公告条任务状态到锚点节点（hub 或已关联剧本包的 starter） */
export function patchAnchorCrewBulletin(
  anchor: CrewBulletinAnchor,
  nodes: CanvasFlowNode[],
  patch: {
    updateNodeData: (id: string, patch: Record<string, unknown>) => void;
    patchGraphMeta?: (
      updater: (
        meta: CanvasGraph["meta"] | null | undefined,
      ) => CanvasGraph["meta"] | null | undefined,
    ) => void;
  },
): void {
  if (!anchor.published || !anchor.bulletin) return;
  const synced = syncCrewBulletinFromCanvasNodes(anchor.bulletin, nodes);
  if (synced === anchor.bulletin) return;

  if (isCrewBulletinGraphMetaAnchor(anchor)) {
    patch.patchGraphMeta?.((meta) => {
      if (!meta?.crewBulletinAnchor) return meta ?? undefined;
      return {
        ...meta,
        crewBulletinAnchor: {
          ...meta.crewBulletinAnchor,
          crewBulletin: synced,
        },
      };
    });
    return;
  }

  patch.updateNodeData(anchor.nodeId, { crewBulletin: synced });
}
