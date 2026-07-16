import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import type { CanvasStoryRunJob } from "./canvas-run-bus";
import type { StoryRunContext } from "./story-workspace-types";
import { formatCanvasTaskError } from "./friendly-task-error";
import {
  isCanvasNodeRunSessionActive,
  shouldSkipStaleTerminalWhileLocalInflight,
} from "./canvas-run-session";
import {
  pickTaskResultMediaUrl,
  taskHasDisplayableResult,
} from "./task-media-url";

export type CanvasTaskStoryScope = {
  rowKey?: string;
  mediaKind?: string;
  llmSection?: string;
};

function taskHasSuccessPayload(task: CanvasTaskRecord): boolean {
  return Boolean(
    task.textOutput?.trim() ||
      pickTaskResultMediaUrl(task) ||
      task.ossUrl?.trim() ||
      task.ephemeralUrl?.trim(),
  );
}

export function isServerInflightTaskStatus(status: string): boolean {
  return (
    status === "QUEUED" ||
    status === "DISPATCHING" ||
    status === "PENDING" ||
    status === "SUBMITTED"
  );
}

/** SUBMITTED 滞后但同节点已有更新的成功成片 → 勿再当作进行中阻塞 UI */
export function isStaleServerInflightTask(
  task: CanvasTaskRecord,
  nodeTasks: CanvasTaskRecord[],
): boolean {
  if (!isServerInflightTaskStatus(task.status)) return false;
  // 用 submittedAt 判定滞后 SUBMITTED；勿用 updatedAt（poll 会刷新导致永远压过 SUCCEEDED）
  const taskTime = new Date(
    task.submittedAt ?? task.createdAt ?? task.updatedAt,
  ).getTime();
  return nodeTasks.some(
    (t) =>
      t.id !== task.id &&
      t.status === "SUCCEEDED" &&
      taskHasSuccessPayload(t) &&
      new Date(t.completedAt ?? t.updatedAt).getTime() >= taskTime,
  );
}

/** 节点任务历史中当前应阻塞终态同步的进行中任务（排除 stale SUBMITTED）。 */
export function pickActiveServerInflightTask(
  nodeTasks: CanvasTaskRecord[],
  boundTaskId?: string | null,
  runtime?: CanvasNodeRuntime | null,
): CanvasTaskRecord | undefined {
  const boundId = boundTaskId?.trim();
  const hasRtMedia = Boolean(
    runtime?.ossUrl?.trim() || runtime?.ephemeralUrl?.trim(),
  );

  if (boundId) {
    const bound = nodeTasks.find((t) => t.id === boundId);
    if (bound && isServerInflightTaskStatus(bound.status)) {
      if (isStaleServerInflightTask(bound, nodeTasks) || hasRtMedia) {
        // fall through
      } else {
        return bound;
      }
    }
  }

  return nodeTasks.find(
    (t) =>
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, nodeTasks),
  );
}

export function canvasTaskInflightLabel(status: string): string | null {
  if (status === "QUEUED") return "排队中…";
  if (status === "DISPATCHING") return "准备生成…";
  if (status === "SUBMITTED") return null;
  if (status === "PENDING") return null;
  return null;
}

function newestTaskByUpdatedAt(
  tasks: CanvasTaskRecord[],
): CanvasTaskRecord | undefined {
  if (!tasks.length) return undefined;
  return [...tasks].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

/** 重新生成时本地已 pending/running，勿用旧终态任务覆盖 UI */
export function shouldSkipStoryRowTaskApply(
  localRuntime: CanvasNodeRuntime | undefined,
  pick: CanvasTaskRecord,
  nodeId?: string,
): boolean {
  if (
    nodeId &&
    isCanvasNodeRunSessionActive(nodeId) &&
    !localRuntime?.taskId?.trim() &&
    localRuntime?.status === "error"
  ) {
    return true;
  }

  const localSt = localRuntime?.status;
  if (localSt !== "pending" && localSt !== "running") return false;
  if (isServerInflightTaskStatus(pick.status)) {
    if (nodeId) {
      return shouldSkipStaleTerminalWhileLocalInflight(nodeId, localRuntime, pick);
    }
    return false;
  }
  if (nodeId) {
    return shouldSkipStaleTerminalWhileLocalInflight(nodeId, localRuntime, pick);
  }
  if (localRuntime?.taskId) {
    if (pick.id === localRuntime.taskId) return false;
  } else {
    // 无 taskId：历史终态一律跳过，避免刚点生成时闪回旧结果
    return (
      pick.status === "SUCCEEDED" ||
      pick.status === "FAILED" ||
      pick.status === "CANCELLED"
    );
  }
  return (
    pick.status === "SUCCEEDED" ||
    pick.status === "FAILED" ||
    pick.status === "CANCELLED"
  );
}

/** 任务终态写回 node.runtime 前 · 用户已关闭的错误勿重复弹出 */
export function shouldApplyCanvasTaskRuntimePatch(
  localRuntime: CanvasNodeRuntime | undefined,
  task: Pick<CanvasTaskRecord, "id" | "status" | "updatedAt" | "createdAt">,
  patch: Partial<CanvasNodeRuntime> | null,
  nodeId?: string,
): boolean {
  if (!patch) return false;
  if (
    nodeId &&
    shouldSkipStaleTerminalWhileLocalInflight(nodeId, localRuntime, task as CanvasTaskRecord)
  ) {
    return false;
  }
  if (patch.status !== "error") return true;
  const hasMedia = Boolean(
    localRuntime?.ossUrl?.trim() || localRuntime?.ephemeralUrl?.trim(),
  );
  if (hasMedia && localRuntime?.status === "done") {
    return false;
  }
  const dismissed = localRuntime?.dismissedFailTaskId?.trim();
  if (!dismissed) return true;
  return task.id !== dismissed;
}

/** 引擎 / 预览节点：把任务终态写进 node.runtime */
export function runtimePatchFromCanvasTask(
  task: CanvasTaskRecord,
): Partial<CanvasNodeRuntime> | null {
  if (task.status === "SUCCEEDED") {
    if (!taskHasSuccessPayload(task)) return null;
    return {
      status: "done",
      taskId: task.id,
      ossUrl: pickTaskResultMediaUrl(task) ?? task.ossUrl ?? undefined,
      ephemeralUrl: task.ephemeralUrl ?? undefined,
      posterUrl: task.posterUrl?.trim() || undefined,
      textOutput: task.textOutput ?? undefined,
      failCode: undefined,
      failMessage: undefined,
    };
  }
  if (task.status === "FAILED" || task.status === "CANCELLED") {
    return {
      status: "error",
      taskId: task.id,
      failCode:
        task.failCode ??
        (task.status === "CANCELLED" ? "CANCELLED" : "FAILED"),
      failMessage: formatCanvasTaskError(
        task.failCode,
        task.failMessage,
        task.model,
      ),
    };
  }
  if (task.status === "SUBMITTED" || task.status === "DISPATCHING") {
    return {
      status: "running",
      taskId: task.id,
      failCode: undefined,
      failMessage: undefined,
    };
  }
  if (task.status === "QUEUED" || task.status === "PENDING") {
    return {
      status: "pending",
      taskId: task.id,
      failCode: undefined,
      failMessage: undefined,
    };
  }
  return null;
}

export function taskStoryScope(
  task: Pick<CanvasTaskRecord, "storyScope">,
): CanvasTaskStoryScope | undefined {
  return task.storyScope;
}

/** 漫剧列行级任务：按 storyScope 过滤，避免同节点多行时 pick 到其它行的历史成功任务 */
export function tasksMatchStoryScope(
  task: CanvasTaskRecord,
  scope: CanvasTaskStoryScope,
): boolean {
  const t = taskStoryScope(task);
  if (!t) return false;
  if (scope.rowKey && t.rowKey !== scope.rowKey) return false;
  if (scope.mediaKind && t.mediaKind !== scope.mediaKind) return false;
  if (scope.llmSection && t.llmSection !== scope.llmSection) return false;
  return true;
}

export function pickPreferredCanvasTaskForScope(
  tasks: CanvasTaskRecord[],
  scope: CanvasTaskStoryScope,
): CanvasTaskRecord | undefined {
  const scoped = tasks.filter((t) => tasksMatchStoryScope(t, scope));
  return pickPreferredCanvasTask(scoped);
}

export function storyRunContextFromScope(
  nodeId: string,
  scope: CanvasTaskStoryScope,
): CanvasStoryRunJob {
  return {
    nodeId,
    rowKey: scope.rowKey,
    mediaKind: scope.mediaKind as StoryRunContext["mediaKind"],
    llmSection: scope.llmSection as StoryRunContext["llmSection"],
  };
}

/**
 * 同一 scope 多条任务：优先最新进行中，否则取最新成功成片，最后才取最新失败终态。
 * 避免轮询误用 updatedAt 更新的失败任务覆盖已有视频/图片（与 pickStoryRowApplyTask 一致）。
 */
export function pickPreferredCanvasTask(
  tasks: CanvasTaskRecord[],
): CanvasTaskRecord | undefined {
  if (!tasks.length) return undefined;
  const inflight = tasks.filter(
    (t) =>
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, tasks),
  );
  if (inflight.length) return newestTaskByUpdatedAt(inflight);

  const succeeded = tasks.filter(
    (t) => t.status === "SUCCEEDED" && taskHasDisplayableResult(t),
  );
  if (succeeded.length) return newestTaskByUpdatedAt(succeeded);

  return newestTaskByUpdatedAt(tasks);
}

function isInflightRuntimeStatus(status?: string): boolean {
  return status === "pending" || status === "running";
}

/** 行级 scope · 最新成功成片（展示 URL，不受后续失败重试覆盖） */
export function pickStoryRowSucceededTask(
  tasks: CanvasTaskRecord[],
  scope: CanvasTaskStoryScope,
): CanvasTaskRecord | undefined {
  const scoped = tasks.filter((t) => tasksMatchStoryScope(t, scope));
  const succeeded = scoped.filter(
    (t) => t.status === "SUCCEEDED" && taskHasDisplayableResult(t),
  );
  return newestTaskByUpdatedAt(succeeded);
}

/**
 * 行级 scope 写回 runtime：非 stale 进行中 > 最新成功成片 > 最新失败（仅无成片时）。
 */
export function pickStoryRowApplyTask(
  tasks: CanvasTaskRecord[],
  scope: CanvasTaskStoryScope,
  localRuntime?: CanvasNodeRuntime | null,
): CanvasTaskRecord | undefined {
  const scoped = tasks.filter((t) => tasksMatchStoryScope(t, scope));
  if (!scoped.length) return undefined;

  const localTaskId = localRuntime?.taskId?.trim();
  const localInflight =
    localTaskId && isInflightRuntimeStatus(localRuntime?.status)
      ? scoped.find(
          (t) =>
            t.id === localTaskId && isServerInflightTaskStatus(t.status),
        )
      : undefined;

  const inflight = scoped.filter(
    (t) =>
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, scoped),
  );

  if (
    localInflight &&
    !isStaleServerInflightTask(localInflight, scoped)
  ) {
    return localInflight;
  }

  if (inflight.length) {
    const pick = newestTaskByUpdatedAt(inflight)!;
    const succeeded = pickStoryRowSucceededTask(tasks, scope);
    if (
      succeeded &&
      pick.status === "SUBMITTED" &&
      pick.id !== succeeded.id &&
      !localInflight
    ) {
      return succeeded;
    }
    return pick;
  }

  const succeeded = pickStoryRowSucceededTask(tasks, scope);
  if (succeeded) return succeeded;

  const failed = scoped.filter(
    (t) => t.status === "FAILED" || t.status === "CANCELLED",
  );
  if (failed.length) return newestTaskByUpdatedAt(failed);

  return newestTaskByUpdatedAt(scoped);
}

export function preferredTasksByNode(
  tasks: CanvasTaskRecord[],
): Map<string, CanvasTaskRecord> {
  const grouped = new Map<string, CanvasTaskRecord[]>();
  for (const t of tasks) {
    const list = grouped.get(t.nodeId) ?? [];
    list.push(t);
    grouped.set(t.nodeId, list);
  }
  const out = new Map<string, CanvasTaskRecord>();
  for (const [nodeId, list] of Array.from(grouped.entries())) {
    const pick = pickPreferredCanvasTask(list);
    if (pick) out.set(nodeId, pick);
  }
  return out;
}

/** 同镜多个 video-engine 时，用任意节点上的成功任务补回缺失/失败 runtime。 */
export function backfillFrameVideoRuntimesFromTasks(
  nodes: CanvasFlowNode[],
  tasks: CanvasTaskRecord[],
  setNodeRuntime: (nodeId: string, patch: Partial<CanvasNodeRuntime>) => void,
): void {
  const videoNodes = nodes.filter((n) => n.type === "video-engine");
  const byFrame = new Map<number, CanvasFlowNode[]>();
  for (const n of videoNodes) {
    const fi = (n.data as { frameIndex?: number }).frameIndex;
    if (fi == null) continue;
    const list = byFrame.get(fi) ?? [];
    list.push(n);
    byFrame.set(fi, list);
  }

  for (const group of Array.from(byFrame.values())) {
    let bestTask: CanvasTaskRecord | undefined;
    for (const node of group) {
      const pick = pickPreferredCanvasTask(
        tasks.filter((t) => t.nodeId === node.id),
      );
      if (pick?.status !== "SUCCEEDED") continue;
      const url = pickTaskResultMediaUrl(pick);
      if (!url && !pick.textOutput) continue;
      if (
        !bestTask ||
        new Date(pick.updatedAt).getTime() >
          new Date(bestTask.updatedAt).getTime()
      ) {
        bestTask = pick;
      }
    }
    if (!bestTask) continue;
    const url = pickTaskResultMediaUrl(bestTask);
    if (!url) continue;

    for (const node of group) {
      const rt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
      if (rt?.status === "done" && (rt.ossUrl || rt.ephemeralUrl)) continue;
      setNodeRuntime(node.id, {
        status: "done",
        taskId: bestTask.id,
        ossUrl: url,
        ephemeralUrl: bestTask.ephemeralUrl ?? undefined,
      });
    }
  }
}
