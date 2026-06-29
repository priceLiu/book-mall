import type { CrewBulletinAnchor } from "./crew-bulletin-context";
import { spawnCrewWorkNodeForTask } from "./crew-bulletin-claim";
import {
  patchCrewBulletinOnAnchor,
  type CrewBulletinPatchStore,
} from "./crew-bulletin-patch";
import type {
  CrewBulletinState,
  CrewBulletinTask,
  CrewTaskStatus,
} from "./crew-bulletin-types";
import { CREW_TASK_STATUS_LABELS } from "./crew-bulletin-types";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type { CrewBulletinPatchStore } from "./crew-bulletin-patch";
export { patchCrewBulletinOnAnchor } from "./crew-bulletin-patch";

export type CrewBulletinClaimStore = CrewBulletinPatchStore & {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: string,
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (
    fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[],
  ) => void;
};

export function crewTaskStatusLine(task: CrewBulletinTask): string {
  const base = CREW_TASK_STATUS_LABELS[task.status] ?? task.status;
  if (task.assigneeDisplayName && task.status !== "unclaimed") {
    return `${base} · ${task.assigneeDisplayName}`;
  }
  return base;
}

export type CrewTaskDisplayStatus = "not_started" | "in_progress" | "done";

/** 公告条统一三色：未开始 / 制作中 / 完成 */
export function crewTaskDisplayStatus(
  status: CrewTaskStatus,
): CrewTaskDisplayStatus {
  if (status === "done") return "done";
  if (status === "unclaimed") return "not_started";
  return "in_progress";
}

export function crewTaskDisplayStatusLabel(
  display: CrewTaskDisplayStatus,
): string {
  switch (display) {
    case "done":
      return "完成";
    case "in_progress":
      return "制作中";
    default:
      return "未开始";
  }
}

export function crewTaskStatusColor(status: CrewTaskStatus): string {
  switch (crewTaskDisplayStatus(status)) {
    case "done":
      return "text-emerald-300/90";
    case "in_progress":
      return "text-amber-300/90";
    default:
      return "text-white/45";
  }
}

/** 工作节点是否已从画布删除 */
export function isCrewTaskWorkNodeMissing(
  task: CrewBulletinTask,
  nodes: CanvasFlowNode[],
): boolean {
  if (!task.canvasNodeId) return true;
  return !nodes.some((n) => n.id === task.canvasNodeId);
}

/** 是否可领取（含误删节点后重新领取） */
export function isCrewTaskClaimable(
  task: CrewBulletinTask,
  nodes: CanvasFlowNode[],
): boolean {
  if (task.kind === "script") return false;
  if (task.status === "unclaimed") return true;
  return isCrewTaskWorkNodeMissing(task, nodes);
}

/** 是否可提交完成（公告栏 · 主槽位） */
export function isCrewTaskSubmittable(task: CrewBulletinTask): boolean {
  return (
    task.status === "claimed" ||
    task.status === "generating" ||
    task.status === "done"
  );
}

/** 是否可撤回误提交 */
export function isCrewTaskRevertable(task: CrewBulletinTask): boolean {
  return task.status === "done";
}

/** 领取所选任务并在画布生成工作节点（支持重复领取） */
export function claimCrewBulletinTasks(
  anchor: CrewBulletinAnchor,
  bulletin: CrewBulletinState,
  hubData: StoryProScriptHubNodeData,
  taskIds: string[],
  assignee: { userId?: string; displayName?: string },
  store: CrewBulletinClaimStore,
): { claimed: number; skipped: number } {
  if (!taskIds.length) return { claimed: 0, skipped: 0 };

  const hubNodeId = bulletin.hubNodeId || anchor.nodeId;
  const idSet = new Set(taskIds);
  let spawnIndex = 0;
  let claimed = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  const tasks = bulletin.tasks.map((task) => {
    if (!idSet.has(task.id)) return task;
    if (!isCrewTaskClaimable(task, store.nodes)) {
      skipped += 1;
      return task;
    }

    const nodeId = spawnCrewWorkNodeForTask(
      task,
      hubNodeId,
      hubData,
      store,
      spawnIndex++,
      { spawnAnchorNodeId: anchor.nodeId },
    );

    if (!nodeId) {
      skipped += 1;
      return task;
    }

    claimed += 1;
    return {
      ...task,
      status: "claimed" as const,
      canvasNodeId: nodeId,
      claimedAt: now,
      completedAt: undefined,
      assigneeUserId: assignee.userId,
      assigneeDisplayName: assignee.displayName ?? "我",
    };
  });

  patchCrewBulletinOnAnchor(anchor, { ...bulletin, tasks }, {
    updateNodeData: store.updateNodeData,
    patchGraphMeta: store.patchGraphMeta,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
    window.dispatchEvent(
      new CustomEvent("canvas:crew-bulletin-changed", {
        detail: { anchorNodeId: anchor.nodeId },
      }),
    );
  }
  return { claimed, skipped };
}

/** 手动标记任务完成（提交） */
export function submitCrewBulletinTaskDone(
  anchor: CrewBulletinAnchor,
  bulletin: CrewBulletinState,
  taskId: string,
  store: CrewBulletinClaimStore,
): boolean {
  const now = new Date().toISOString();
  let hit = false;
  const tasks = bulletin.tasks.map((task) => {
    if (task.id !== taskId) return task;
    if (!isCrewTaskSubmittable(task)) return task;
    hit = true;
    return {
      ...task,
      status: "done" as const,
      completedAt: now,
    };
  });
  if (!hit) return false;
  patchCrewBulletinOnAnchor(anchor, { ...bulletin, tasks }, {
    updateNodeData: store.updateNodeData,
    patchGraphMeta: store.patchGraphMeta,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
    window.dispatchEvent(
      new CustomEvent("canvas:crew-bulletin-changed", {
        detail: { anchorNodeId: anchor.nodeId },
      }),
    );
  }
  return true;
}

/** 撤回误提交 · 恢复为已领取（可再次提交） */
export function revertCrewBulletinTaskDone(
  anchor: CrewBulletinAnchor,
  bulletin: CrewBulletinState,
  taskId: string,
  store: CrewBulletinClaimStore,
): boolean {
  let hit = false;
  const tasks = bulletin.tasks.map((task) => {
    if (task.id !== taskId) return task;
    if (!isCrewTaskRevertable(task)) return task;
    hit = true;
    return {
      ...task,
      status: "claimed" as const,
      completedAt: undefined,
    };
  });
  if (!hit) return false;
  patchCrewBulletinOnAnchor(anchor, { ...bulletin, tasks }, {
    updateNodeData: store.updateNodeData,
    patchGraphMeta: store.patchGraphMeta,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
    window.dispatchEvent(
      new CustomEvent("canvas:crew-bulletin-changed", {
        detail: { anchorNodeId: anchor.nodeId },
      }),
    );
  }
  return true;
}
