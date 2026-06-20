"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  isCanvasApiAccessDeniedError,
  isCanvasProjectTasksForbidden,
  listCanvasProjectTasks,
  type CanvasTaskRecord,
} from "@/lib/canvas-api";
import { taskHasDisplayableResult } from "./task-media-url";
import { useCanvasStore } from "./store";

const TASK_HISTORY_POLL_MS = 2000;
/** 打开画布后合并批量拉任务，避免 N 个节点各发一次 HTTP */
const BATCH_DEBOUNCE_MS = 120;
/** 首屏后再拉历史，与媒体懒加载错开 */
const INITIAL_FETCH_DELAY_MS = 1200;

type ProjectTaskPool = {
  tasks: CanvasTaskRecord[];
  pollForbidden: boolean;
  subscribers: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  initialTimer: ReturnType<typeof setTimeout> | null;
  inflight: boolean;
  needsInflightPoll: boolean;
  listeners: Set<() => void>;
};

const pools = new Map<string, ProjectTaskPool>();

function getPool(projectId: string): ProjectTaskPool {
  let pool = pools.get(projectId);
  if (!pool) {
    pool = {
      tasks: [],
      pollForbidden: false,
      subscribers: 0,
      pollTimer: null,
      debounceTimer: null,
      initialTimer: null,
      inflight: false,
      needsInflightPoll: false,
      listeners: new Set(),
    };
    pools.set(projectId, pool);
  }
  return pool;
}

function emitPool(projectId: string) {
  const pool = pools.get(projectId);
  if (!pool) return;
  for (const listener of pool.listeners) listener();
}

function stopPollTimer(pool: ProjectTaskPool) {
  if (pool.pollTimer) {
    clearInterval(pool.pollTimer);
    pool.pollTimer = null;
  }
}

function clearPoolTimers(pool: ProjectTaskPool) {
  if (pool.debounceTimer) {
    clearTimeout(pool.debounceTimer);
    pool.debounceTimer = null;
  }
  if (pool.initialTimer) {
    clearTimeout(pool.initialTimer);
    pool.initialTimer = null;
  }
  stopPollTimer(pool);
}

function disposePool(projectId: string) {
  const pool = pools.get(projectId);
  if (!pool) return;
  clearPoolTimers(pool);
  pools.delete(projectId);
}

function ensureProjectTaskPoll(projectId: string, base: string) {
  const pool = getPool(projectId);
  if (pool.pollForbidden || pool.pollTimer) return;
  pool.pollTimer = setInterval(() => {
    void refreshProjectTasks(projectId, base);
  }, TASK_HISTORY_POLL_MS);
}

async function refreshProjectTasks(projectId: string, base: string) {
  const pool = getPool(projectId);
  if (pool.pollForbidden || pool.inflight) return;
  if (isCanvasProjectTasksForbidden(projectId)) {
    pool.pollForbidden = true;
    stopPollTimer(pool);
    emitPool(projectId);
    return;
  }

  pool.inflight = true;
  try {
    const tasks = await listCanvasProjectTasks(base, projectId);
    pool.tasks = tasks;
    pool.needsInflightPoll = tasks.some(
      (t) =>
        t.status === "QUEUED" ||
        t.status === "DISPATCHING" ||
        t.status === "PENDING" ||
        t.status === "SUBMITTED",
    );
    if (!pool.needsInflightPoll) stopPollTimer(pool);
    else ensureProjectTaskPoll(projectId, base);
    emitPool(projectId);
  } catch (e) {
    if (isCanvasApiAccessDeniedError(e)) {
      pool.pollForbidden = true;
      stopPollTimer(pool);
      emitPool(projectId);
    }
  } finally {
    pool.inflight = false;
  }
}

function scheduleProjectTaskRefresh(projectId: string, base: string) {
  const pool = getPool(projectId);
  if (pool.pollForbidden) return;
  if (pool.debounceTimer) clearTimeout(pool.debounceTimer);
  pool.debounceTimer = setTimeout(() => {
    pool.debounceTimer = null;
    void refreshProjectTasks(projectId, base);
  }, BATCH_DEBOUNCE_MS);
}

/** 生成中立即拉任务，不走 debounce */
function flushProjectTaskRefresh(projectId: string, base: string) {
  const pool = getPool(projectId);
  if (pool.pollForbidden) return;
  if (pool.debounceTimer) {
    clearTimeout(pool.debounceTimer);
    pool.debounceTimer = null;
  }
  if (pool.initialTimer) {
    clearTimeout(pool.initialTimer);
    pool.initialTimer = null;
  }
  ensureProjectTaskPoll(projectId, base);
  void refreshProjectTasks(projectId, base);
}

function subscribeProjectTasks(
  projectId: string,
  base: string,
  listener: () => void,
) {
  const pool = getPool(projectId);
  pool.subscribers += 1;
  pool.listeners.add(listener);

  if (!pool.initialTimer && !pool.pollForbidden) {
    pool.initialTimer = setTimeout(() => {
      pool.initialTimer = null;
      scheduleProjectTaskRefresh(projectId, base);
    }, INITIAL_FETCH_DELAY_MS);
  }

  return () => {
    pool.listeners.delete(listener);
    pool.subscribers -= 1;
    if (pool.subscribers <= 0) disposePool(projectId);
  };
}

function getProjectTasksSnapshot(projectId: string): CanvasTaskRecord[] {
  return pools.get(projectId)?.tasks ?? [];
}

function getProjectPollForbidden(projectId: string): boolean {
  return pools.get(projectId)?.pollForbidden ?? false;
}

function isLocalInflightStatus(status?: string): boolean {
  return status === "pending" || status === "running";
}

/** 拉取某节点的任务历史；生图引擎 / 输出节点复用（项目级批量池）。 */
export function useNodeTaskHistory(nodeId: string | null | undefined) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const runtimeTaskId = useCanvasStore((s) => {
    if (!nodeId) return undefined;
    const n = s.nodes.find((x) => x.id === nodeId);
    return (n?.data as { runtime?: { taskId?: string; status?: string } })
      ?.runtime?.taskId;
  });
  const runtimeStatus = useCanvasStore((s) => {
    if (!nodeId) return undefined;
    const n = s.nodes.find((x) => x.id === nodeId);
    return (n?.data as { runtime?: { status?: string } })?.runtime?.status;
  });

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!projectId || !base) return () => {};
      return subscribeProjectTasks(projectId, base, listener);
    },
    [projectId, base],
  );

  const getSnapshot = useCallback(() => {
    if (!projectId) return [] as CanvasTaskRecord[];
    return getProjectTasksSnapshot(projectId);
  }, [projectId]);

  const allTasks = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const pollForbidden = projectId ? getProjectPollForbidden(projectId) : false;

  const history = useMemo(() => {
    if (!nodeId) return [];
    return allTasks.filter((t) => t.nodeId === nodeId);
  }, [allTasks, nodeId]);

  const refreshHistory = useCallback(async () => {
    if (!base || !projectId || !nodeId || pollForbidden) return;
    if (isLocalInflightStatus(runtimeStatus)) {
      flushProjectTaskRefresh(projectId, base);
    } else {
      scheduleProjectTaskRefresh(projectId, base);
    }
  }, [base, projectId, nodeId, pollForbidden, runtimeStatus]);

  useEffect(() => {
    if (!base || !projectId || pollForbidden) return;
    if (isLocalInflightStatus(runtimeStatus)) {
      flushProjectTaskRefresh(projectId, base);
      return;
    }
    scheduleProjectTaskRefresh(projectId, base);
  }, [base, projectId, pollForbidden, runtimeTaskId, runtimeStatus]);

  const succeeded = useMemo(
    () =>
      history
        .filter((t) => taskHasDisplayableResult(t))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [history],
  );

  return { history, succeeded, refreshHistory };
}
