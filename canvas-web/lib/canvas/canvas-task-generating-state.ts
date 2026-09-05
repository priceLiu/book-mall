import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { findPro2CharacterThreeViewNodeForRow } from "./pro2-group-row-resolve";
import {
  isAbandonedCanvasInflightTask,
  isServerInflightTaskStatus,
  isStaleServerInflightTask,
  tasksMatchStoryScope,
  type CanvasTaskStoryScope,
} from "./task-pick";
import type { CanvasFlowNode, CanvasNodeRunStatus } from "./types";

export type CanvasGeneratingMediaRuntime = {
  status?: CanvasNodeRunStatus | string;
  taskId?: string;
  ossUrl?: string;
  ephemeralUrl?: string;
  failMessage?: string;
};

export type CanvasGeneratingMediaData = {
  uploading?: unknown;
  blobUrl?: string;
  ossUrl?: string;
  runtime?: CanvasGeneratingMediaRuntime | null;
};

export type CanvasGeneratingState = {
  isGenerating: boolean;
  reason?:
    | "server_inflight"
    | "optimistic_session"
    | "runtime_inflight"
    | "uploading"
    | "idle";
  boundTaskId?: string;
};

export function isCanvasInflightRunStatus(status?: string): boolean {
  return status === "queued" || status === "pending" || status === "running";
}

export function rowRuntimeHasPersistedMedia(
  rt?: CanvasGeneratingMediaRuntime | null,
): boolean {
  return Boolean(rt?.ossUrl?.trim() || rt?.ephemeralUrl?.trim());
}

/** LibTV / 三视图节点 · 是否应显示扫光（与顶栏计数一致） */
export function resolveLibtvMediaGeneratingState(
  data: CanvasGeneratingMediaData,
): CanvasGeneratingState {
  const s = data.runtime?.status;
  const rt = data.runtime;
  const hasPersistedMedia = rowRuntimeHasPersistedMedia(rt);

  // 终态优先：已有可预览媒体时结束扫光（TTS 常先 data:/blob，OSS 后台补）
  if (s === "done" || s === "error" || s === "idle") {
    const hasPreview =
      hasPersistedMedia || Boolean(String(data.blobUrl ?? "").trim());
    if (s === "done" && data.uploading && !hasPreview) {
      return {
        isGenerating: true,
        reason: "uploading",
        boundTaskId: rt?.taskId,
      };
    }
    return { isGenerating: false, reason: "idle" };
  }

  if (data.uploading) {
    const blob = String(data.blobUrl ?? "").trim();
    const hasGenTask = Boolean(rt?.taskId?.trim());
    const genInflight = isCanvasInflightRunStatus(s);
    if (blob && !hasGenTask && !genInflight) {
      return { isGenerating: false, reason: "idle" };
    }
    if (s === "done" && hasPersistedMedia) {
      return { isGenerating: false, reason: "idle" };
    }
    return { isGenerating: true, reason: "uploading", boundTaskId: rt?.taskId };
  }

  if (isCanvasInflightRunStatus(s)) {
    return {
      isGenerating: true,
      reason: "runtime_inflight",
      boundTaskId: rt?.taskId,
    };
  }
  if (hasPersistedMedia) {
    return { isGenerating: false, reason: "idle" };
  }
  return { isGenerating: false, reason: "idle" };
}

export function libtvMediaLooksGenerating(data: CanvasGeneratingMediaData): boolean {
  return resolveLibtvMediaGeneratingState(data).isGenerating;
}

function hasServerInflightForScope(
  tasks: CanvasTaskRecord[],
  nodeId: string,
  scope: CanvasTaskStoryScope,
): boolean {
  const nodeTasks = tasks.filter((t) => t.nodeId === nodeId);
  return nodeTasks.some(
    (t) =>
      tasksMatchStoryScope(t, scope) &&
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, nodeTasks) &&
      !isAbandonedCanvasInflightTask(t),
  );
}

/** 角色列行 · 是否与 linked 三视图 / 服务端任务一致地处于生成中 */
export function resolveCharacterRowGeneratingState(input: {
  row: {
    key?: string;
    runtime?: CanvasGeneratingMediaRuntime;
  };
  columnId: string;
  nodes: CanvasFlowNode[];
  tasks?: CanvasTaskRecord[];
  optimisticSessionActive?: boolean;
}): CanvasGeneratingState {
  const { row, columnId, nodes, tasks, optimisticSessionActive } = input;
  const rt = row.runtime;
  const scope: CanvasTaskStoryScope = {
    rowKey: row.key,
    mediaKind: "threeView",
  };

  if (tasks?.length && hasServerInflightForScope(tasks, columnId, scope)) {
    const bound = tasks.find(
      (t) =>
        t.nodeId === columnId &&
        tasksMatchStoryScope(t, scope) &&
        isServerInflightTaskStatus(t.status),
    );
    return {
      isGenerating: true,
      reason: "server_inflight",
      boundTaskId: bound?.id,
    };
  }

  if (optimisticSessionActive && isCanvasInflightRunStatus(rt?.status)) {
    return {
      isGenerating: true,
      reason: "optimistic_session",
      boundTaskId: rt?.taskId,
    };
  }

  if (!isCanvasInflightRunStatus(rt?.status)) {
    return { isGenerating: false, reason: "idle" };
  }

  const rowKey = row.key?.trim();
  if (rowKey) {
    const tv = findPro2CharacterThreeViewNodeForRow(nodes, columnId, rowKey);
    if (tv) {
      const nodeState = resolveLibtvMediaGeneratingState(
        tv.data as CanvasGeneratingMediaData,
      );
      return nodeState.isGenerating
        ? nodeState
        : { isGenerating: false, reason: "idle" };
    }
  }

  if (rowRuntimeHasPersistedMedia(rt)) {
    if (rt?.taskId?.trim() || rt?.status === "running") {
      return {
        isGenerating: true,
        reason: "runtime_inflight",
        boundTaskId: rt?.taskId,
      };
    }
    return { isGenerating: false, reason: "idle" };
  }

  return {
    isGenerating: true,
    reason: "runtime_inflight",
    boundTaskId: rt?.taskId,
  };
}

export function characterRowCountsAsInflight(
  row: { key?: string; runtime?: CanvasGeneratingMediaRuntime },
  columnId: string,
  nodes: CanvasFlowNode[],
  tasks?: CanvasTaskRecord[],
): boolean {
  return resolveCharacterRowGeneratingState({
    row,
    columnId,
    nodes,
    tasks,
  }).isGenerating;
}

/** 三视图节点顶栏计数：列行已计或列行已非 in-flight 时不重复计孤儿 node.runtime */
export function pro2ThreeViewNodeCountsAsInflight(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  tasks?: CanvasTaskRecord[],
): boolean {
  const rt = (node.data as { runtime?: { status?: string } }).runtime?.status;
  if (!isCanvasInflightRunStatus(rt)) return false;

  const d = node.data as {
    pro2ControllerNodeId?: string;
    pro2RowKey?: string;
    uploading?: boolean;
  };
  const controllerId = d.pro2ControllerNodeId?.trim();
  const rowKey = d.pro2RowKey?.trim();
  if (!controllerId || !rowKey) {
    return (
      isCanvasInflightRunStatus(rt) ||
      Boolean(d.uploading) ||
      libtvMediaLooksGenerating(node.data as CanvasGeneratingMediaData)
    );
  }

  const col = nodes.find((n) => n.id === controllerId);
  const row = (col?.data as { rows?: { key?: string; runtime?: CanvasGeneratingMediaRuntime }[] })
    .rows?.find((r) => r.key === rowKey);
  if (
    row &&
    resolveCharacterRowGeneratingState({
      row,
      columnId: controllerId,
      nodes,
      tasks,
    }).isGenerating
  ) {
    return false;
  }

  return libtvMediaLooksGenerating(node.data as CanvasGeneratingMediaData);
}
