import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import type { CanvasStoryRunJob } from "./canvas-run-bus";
import type { StoryRunContext } from "./story-workspace-types";
import { formatCanvasTaskError } from "./friendly-task-error";
import {
  canvasIdleRuntimeAfterUserCancel,
  isUserCancelledCanvasTask,
} from "./canvas-generation-cancel-messages";
import {
  canvasNodeRunSessionStartedAtMs,
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

/** 超过合理等待上限的进行中任务 · 勿再恢复 UI「生成中」（旧项目孤儿任务） */
export const CANVAS_ABANDONED_INFLIGHT_MS = 6 * 60 * 60 * 1000;

export function isAbandonedCanvasInflightTask(task: CanvasTaskRecord): boolean {
  if (!isServerInflightTaskStatus(task.status)) return false;
  const ts = new Date(
    task.submittedAt ?? task.updatedAt ?? task.createdAt,
  ).getTime();
  return Date.now() - ts > CANVAS_ABANDONED_INFLIGHT_MS;
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
  _runtime?: CanvasNodeRuntime | null,
): CanvasTaskRecord | undefined {
  const boundId = boundTaskId?.trim();

  if (boundId) {
    const bound = nodeTasks.find((t) => t.id === boundId);
    if (
      bound &&
      isServerInflightTaskStatus(bound.status) &&
      !isStaleServerInflightTask(bound, nodeTasks) &&
      !isAbandonedCanvasInflightTask(bound)
    ) {
      return bound;
    }
  }

  const inflight = nodeTasks.filter(
    (t) =>
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, nodeTasks) &&
      !isAbandonedCanvasInflightTask(t),
  );
  if (!inflight.length) return undefined;
  return [...inflight].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
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
  const localTaskId = localRuntime?.taskId?.trim();
  // 已绑定任务进入终态：必须写回（Gateway 已成功但 UI 仍扫光）
  if (localTaskId && pick.id === localTaskId) {
    if (
      pick.status === "SUCCEEDED" ||
      pick.status === "FAILED" ||
      pick.status === "CANCELLED"
    ) {
      return false;
    }
  }
  if (pick.status === "SUCCEEDED" && taskHasDisplayableResult(pick)) {
    const localSt = localRuntime?.status;
    if (
      localSt === "pending" ||
      localSt === "running" ||
      localSt === "queued"
    ) {
      if (!localTaskId) {
        if (!nodeId || !isCanvasNodeRunSessionActive(nodeId)) return false;
        const startedAt = canvasNodeRunSessionStartedAtMs(nodeId);
        const pickMs = Date.parse(
          pick.completedAt ?? pick.updatedAt ?? pick.createdAt ?? "",
        );
        if (Number.isFinite(pickMs) && pickMs >= startedAt - 3000) {
          return false;
        }
      } else if (pick.id === localTaskId) {
        return false;
      }
    }
  }

  if (
    nodeId &&
    isCanvasNodeRunSessionActive(nodeId) &&
    !localTaskId &&
    localRuntime?.status === "error"
  ) {
    return true;
  }

  const localSt = localRuntime?.status;
  if (
    localSt !== "pending" &&
    localSt !== "running" &&
    localSt !== "queued"
  ) {
    return false;
  }
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
    return (
      pick.status === "SUCCEEDED" ||
      pick.status === "FAILED" ||
      pick.status === "CANCELLED"
    );
  }
  // 无 taskId + 本地仍扫光：终态必须写回（含 OSS 未就绪、无 preview URL 的 SUCCEEDED）
  if (
    pick.status === "SUCCEEDED" ||
    pick.status === "FAILED" ||
    pick.status === "CANCELLED"
  ) {
    return false;
  }
  return false;
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
    if (isUserCancelledCanvasTask(task)) {
      return canvasIdleRuntimeAfterUserCancel(task.id);
    }
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
  localRuntime?: CanvasNodeRuntime | null,
  nodeId?: string,
): CanvasTaskRecord | undefined {
  const scoped = tasks.filter((t) => tasksMatchStoryScope(t, scope));
  return pickPreferredCanvasTask(scoped, { localRuntime, nodeId });
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
  opts?: { localRuntime?: CanvasNodeRuntime | null; nodeId?: string },
): CanvasTaskRecord | undefined {
  if (!tasks.length) return undefined;

  const localTaskId = opts?.localRuntime?.taskId?.trim();
  const localInflight = isInflightRuntimeStatus(opts?.localRuntime?.status);
  // 乐观 pending/running 尚无 taskId：只认服务端在途，勿 pick 上一轮 SUCCEEDED
  if (localInflight && !localTaskId) {
    const inflight = tasks.filter(
      (t) =>
        isServerInflightTaskStatus(t.status) &&
        !isStaleServerInflightTask(t, tasks) &&
        !isAbandonedCanvasInflightTask(t),
    );
    if (inflight.length) return newestTaskByUpdatedAt(inflight);
    // 在途已结束：认本轮会话内最新终态（Gateway 已返回但本地尚未 bind taskId）
    const nodeId = opts?.nodeId?.trim();
    if (nodeId && isCanvasNodeRunSessionActive(nodeId)) {
      const startedAt = canvasNodeRunSessionStartedAtMs(nodeId);
      const sessionTerminal = tasks.filter((t) => {
        if (isServerInflightTaskStatus(t.status)) return false;
        if (t.status === "SUCCEEDED" && !taskHasDisplayableResult(t)) {
          return false;
        }
        if (
          t.status !== "SUCCEEDED" &&
          t.status !== "FAILED" &&
          t.status !== "CANCELLED"
        ) {
          return false;
        }
        const pickMs = Date.parse(t.updatedAt || t.createdAt || "");
        return Number.isFinite(pickMs) && pickMs >= startedAt - 3000;
      });
      if (sessionTerminal.length) {
        return newestTaskByUpdatedAt(sessionTerminal);
      }
    }
    return undefined;
  }
  if (localTaskId && localInflight) {
    const bound = tasks.find((t) => t.id === localTaskId);
    if (bound) {
      if (bound.status === "SUCCEEDED" && taskHasDisplayableResult(bound)) {
        return bound;
      }
      if (
        isServerInflightTaskStatus(bound.status) &&
        !isStaleServerInflightTask(bound, tasks) &&
        !isAbandonedCanvasInflightTask(bound)
      ) {
        return bound;
      }
      // 本轮 batch 已失败/取消：须写回终态，勿被更早 SUCCEEDED 挡住（否则行级 pending 永不消失）
      if (bound.status === "FAILED" || bound.status === "CANCELLED") {
        return bound;
      }
    }
  }

  const inflight = tasks.filter(
    (t) =>
      isServerInflightTaskStatus(t.status) &&
      !isStaleServerInflightTask(t, tasks) &&
      !isAbandonedCanvasInflightTask(t),
  );
  if (inflight.length) return newestTaskByUpdatedAt(inflight);

  const succeeded = tasks.filter(
    (t) => t.status === "SUCCEEDED" && taskHasDisplayableResult(t),
  );
  if (succeeded.length) return newestTaskByUpdatedAt(succeeded);

  return newestTaskByUpdatedAt(tasks);
}

function isInflightRuntimeStatus(status?: string): boolean {
  return status === "queued" || status === "pending" || status === "running";
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
  const bound = localTaskId
    ? scoped.find((t) => t.id === localTaskId)
    : undefined;
  if (
    bound &&
    localRuntime &&
    isInflightRuntimeStatus(localRuntime.status) &&
    (bound.status === "FAILED" || bound.status === "CANCELLED")
  ) {
    return bound;
  }

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
      !isStaleServerInflightTask(t, scoped) &&
      !isAbandonedCanvasInflightTask(t),
  );

  if (
    localInflight &&
    !isStaleServerInflightTask(localInflight, scoped) &&
    !isAbandonedCanvasInflightTask(localInflight)
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
      (!localInflight || localInflight.id === pick.id)
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
  nodes?: CanvasFlowNode[],
): Map<string, CanvasTaskRecord> {
  const grouped = new Map<string, CanvasTaskRecord[]>();
  for (const t of tasks) {
    const list = grouped.get(t.nodeId) ?? [];
    list.push(t);
    grouped.set(t.nodeId, list);
  }
  const out = new Map<string, CanvasTaskRecord>();
  for (const [nodeId, list] of Array.from(grouped.entries())) {
    const node = nodes?.find((n) => n.id === nodeId);
    const localRt = (node?.data as { runtime?: CanvasNodeRuntime } | undefined)
      ?.runtime;
    const pick = pickPreferredCanvasTask(list, { localRuntime: localRt });
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
