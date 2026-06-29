import type { CrewBulletinAnchor } from "./crew-bulletin-context";
import {
  isCrewTaskCanonicalWorkNode,
  isCrewTaskNodeFork,
  nodeHasCrewTaskOutput,
} from "./crew-bulletin-node-output";
import {
  patchCrewBulletinOnAnchor,
  type CrewBulletinPatchStore,
} from "./crew-bulletin-patch";
import type {
  CrewBulletinState,
  CrewBulletinTask,
  CrewTaskForkSubmission,
} from "./crew-bulletin-types";
import type { CanvasFlowNode } from "./types";

/** 节点顶栏「完成制作」是否可用 */
export function canCompleteCrewTaskFromNode(
  task: CrewBulletinTask | undefined,
  node: CanvasFlowNode | undefined,
): boolean {
  if (!task || !node || task.kind === "script") return false;
  const data = node.data as Record<string, unknown> | undefined;
  const crewTaskId = data?.crewTaskId;
  if (typeof crewTaskId !== "string" || crewTaskId !== task.id) return false;
  if (task.status === "unclaimed") return false;
  return nodeHasCrewTaskOutput(data);
}

/**
 * 从画布节点提交「完成制作」：
 * - 原节点（公告栏 canvasNodeId 且非 fork）→ 覆盖主任务槽
 * - 复制节点（crewTaskFork）→ 追加 forkSubmissions，不覆盖主槽
 */
export function submitCrewBulletinTaskFromNode(
  anchor: CrewBulletinAnchor,
  bulletin: CrewBulletinState,
  nodeId: string,
  nodes: CanvasFlowNode[],
  store: CrewBulletinPatchStore,
  assignee?: { userId?: string; displayName?: string },
): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  const data = node.data as Record<string, unknown> | undefined;
  const crewTaskId = data?.crewTaskId;
  if (typeof crewTaskId !== "string") return false;

  const task = bulletin.tasks.find((t) => t.id === crewTaskId);
  if (!task || !canCompleteCrewTaskFromNode(task, node)) return false;

  const now = new Date().toISOString();
  const isFork = isCrewTaskNodeFork(data);
  const isCanonical = isCrewTaskCanonicalWorkNode(
    task.canvasNodeId,
    nodeId,
    data,
  );

  if (isFork || !isCanonical) {
    const submission: CrewTaskForkSubmission = {
      nodeId,
      submittedAt: now,
      assigneeUserId: assignee?.userId ?? task.assigneeUserId,
      assigneeDisplayName:
        assignee?.displayName ?? task.assigneeDisplayName ?? "我",
    };
    let hit = false;
    const tasks = bulletin.tasks.map((t) => {
      if (t.id !== crewTaskId) return t;
      hit = true;
      return {
        ...t,
        forkSubmissions: [...(t.forkSubmissions ?? []), submission],
      };
    });
    if (!hit) return false;
    patchCrewBulletinOnAnchor(anchor, { ...bulletin, tasks }, {
      updateNodeData: store.updateNodeData,
      patchGraphMeta: store.patchGraphMeta,
    });
    store.updateNodeData(nodeId, { crewTaskLastSubmittedAt: now });
    dispatchCrewBulletinChanged(anchor.nodeId);
    return true;
  }

  let hit = false;
  const tasks = bulletin.tasks.map((t) => {
    if (t.id !== crewTaskId) return t;
    hit = true;
    return {
      ...t,
      status: "done" as const,
      completedAt: now,
      assigneeUserId: assignee?.userId ?? t.assigneeUserId,
      assigneeDisplayName:
        assignee?.displayName ?? t.assigneeDisplayName ?? "我",
    };
  });
  if (!hit) return false;
  patchCrewBulletinOnAnchor(anchor, { ...bulletin, tasks }, {
    updateNodeData: store.updateNodeData,
    patchGraphMeta: store.patchGraphMeta,
  });
  store.updateNodeData(nodeId, { crewTaskLastSubmittedAt: now });
  dispatchCrewBulletinChanged(anchor.nodeId);
  return true;
}

function dispatchCrewBulletinChanged(anchorNodeId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
  window.dispatchEvent(
    new CustomEvent("canvas:crew-bulletin-changed", {
      detail: { anchorNodeId },
    }),
  );
}
