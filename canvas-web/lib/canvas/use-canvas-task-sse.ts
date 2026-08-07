"use client";

import { useEffect, useRef, useState } from "react";

import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import { emitCanvasTasksChanged } from "@/lib/canvas/canvas-panel-sync-events";

/**
 * 条件 SSE：仅 inflightCount>0 且 tab visible 时连接 /task-events。
 * 收到 tasks-changed → emitCanvasTasksChanged → run-queue pollKick。
 * JSON task-sync 仍为 fallback。
 */
export function useCanvasTaskSse(
  base: string | null | undefined,
  projectId: string | null | undefined,
  inflightCount: number,
  enabled = true,
): void {
  const esRef = useRef<EventSource | null>(null);
  const [tabVisible, setTabVisible] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      setTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!enabled || !base || !projectId || typeof window === "undefined") {
      return;
    }

    const disconnect = () => {
      esRef.current?.close();
      esRef.current = null;
    };

    const shouldConnect = inflightCount > 0 && tabVisible;
    if (!shouldConnect) {
      disconnect();
      return disconnect;
    }

    const { url } = resolveBookMallBrowserRequest(
      base,
      `/api/canvas/projects/${projectId}/task-events`,
    );
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    const onTasksChanged = () => {
      emitCanvasTasksChanged(projectId);
    };
    es.addEventListener("tasks-changed", onTasksChanged);

    return () => {
      es.removeEventListener("tasks-changed", onTasksChanged);
      disconnect();
    };
  }, [base, projectId, inflightCount, tabVisible, enabled]);
}
