"use client";

import { useEffect, useRef } from "react";

import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import {
  notifyCanvasTaskPanelSync,
  type CanvasTaskPanelSyncDetail,
} from "@/lib/canvas/canvas-panel-sync-events";

/**
 * P3 · 订阅 book-mall 任务 SSE；指纹变更时 invalidate 侧栏缓存。
 * 经 canvas-web BFF 代理，与 REST 共用 cookie / tools token。
 */
export function useCanvasTaskEventStream(
  base: string | null | undefined,
  projectId: string | null | undefined,
  enabled = true,
): void {
  const lastFingerprintRef = useRef<string>("");

  useEffect(() => {
    if (!enabled || !base || !projectId || typeof window === "undefined") {
      return;
    }

    const { url } = resolveBookMallBrowserRequest(
      base,
      `/api/canvas/projects/${projectId}/task-events`,
    );

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let retryMs = 15_000;

    const connect = () => {
      if (disposed) return;
      es = new EventSource(url, { withCredentials: true });

      es.addEventListener("open", () => {
        retryMs = 15_000;
      });

      es.addEventListener("tasks-changed", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            projectId?: string;
            fingerprint?: string;
            inflightCount?: number;
          };
          if (data.projectId !== projectId) return;
          if (
            data.fingerprint &&
            data.fingerprint === lastFingerprintRef.current
          ) {
            return;
          }
          if (data.fingerprint) lastFingerprintRef.current = data.fingerprint;
          const detail: CanvasTaskPanelSyncDetail = {
            projectId,
            terminal: (data.inflightCount ?? 0) === 0,
          };
          notifyCanvasTaskPanelSync(detail);
        } catch {
          notifyCanvasTaskPanelSync({ projectId });
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (!disposed) {
          retryTimer = setTimeout(connect, retryMs);
          retryMs = Math.min(Math.round(retryMs * 1.8), 120_000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [base, projectId, enabled]);
}
