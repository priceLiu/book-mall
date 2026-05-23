"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { listCanvasProjectTasks, type CanvasTaskRecord } from "@/lib/canvas-api";
import { useCanvasStore } from "./store";

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

  const refreshHistory = useCallback(async () => {
    if (!base || !projectId || !nodeId) return;
    try {
      const tasks = await listCanvasProjectTasks(base, projectId, [nodeId]);
      setHistory(tasks);
    } catch {
      // ignore
    }
  }, [base, projectId, nodeId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory, runtimeTaskId, runtimeStatus]);

  const succeeded = useMemo(
    () =>
      history
        .filter((t) => t.status === "SUCCEEDED" && t.ossUrl)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [history],
  );

  return { history, succeeded, refreshHistory };
}
