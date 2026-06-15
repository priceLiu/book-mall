"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

/** 拉取某节点的任务历史；生图引擎 / 输出节点复用。 */
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

  const [history, setHistory] = useState<CanvasTaskRecord[]>([]);
  const [pollForbidden, setPollForbidden] = useState(false);

  const refreshHistory = useCallback(async () => {
    if (!base || !projectId || !nodeId || pollForbidden) return;
    if (isCanvasProjectTasksForbidden(projectId)) {
      setPollForbidden(true);
      return;
    }
    try {
      const tasks = await listCanvasProjectTasks(base, projectId, [nodeId]);
      setHistory(tasks);
    } catch (e) {
      if (isCanvasApiAccessDeniedError(e)) setPollForbidden(true);
    }
  }, [base, projectId, nodeId, pollForbidden]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory, runtimeTaskId, runtimeStatus]);

  /** 进行中时额外拉历史，避免 KIE 已完成但节点 runtime 尚未同步 */
  useEffect(() => {
    if (pollForbidden) return;
    if (runtimeStatus !== "running" && runtimeStatus !== "pending") return;
    const id = window.setInterval(() => void refreshHistory(), TASK_HISTORY_POLL_MS);
    return () => window.clearInterval(id);
  }, [pollForbidden, runtimeStatus, refreshHistory]);

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
