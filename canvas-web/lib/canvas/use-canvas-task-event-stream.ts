"use client";

import { useEffect, useRef } from "react";

import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import {
  notifyCanvasTaskPanelSync,
  type CanvasTaskPanelSyncDetail,
} from "@/lib/canvas/canvas-panel-sync-events";

const ACTIVE_POLL_MS = 12_000;
const IDLE_POLL_MS = 30_000;
const FETCH_TIMEOUT_MS = 12_000;
const ERROR_BACKOFF_MS = 60_000;

/**
 * P3 · 轮询 book-mall 任务指纹（JSON），变更时 invalidate 侧栏。
 * 刻意不用 EventSource：SSE 长连接会让 Chrome 标签页 loading 图标一直转。
 */
export function useCanvasTaskEventStream(
  base: string | null | undefined,
  projectId: string | null | undefined,
  enabled = true,
): void {
  const lastFingerprintRef = useRef<string>("");
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || !base || !projectId || typeof window === "undefined") {
      return;
    }

    const { url: urlBase } = resolveBookMallBrowserRequest(
      base,
      `/api/canvas/projects/${projectId}/task-sync`,
    );

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let nextDelayMs = IDLE_POLL_MS;

    const schedule = (delayMs: number) => {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (disposed || document.visibilityState === "hidden") {
        schedule(Math.max(nextDelayMs, IDLE_POLL_MS));
        return;
      }
      if (inFlightRef.current) {
        schedule(2000);
        return;
      }

      inFlightRef.current = true;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS,
      );

      try {
        const res = await fetch(urlBase, {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          nextDelayMs = ERROR_BACKOFF_MS;
          schedule(nextDelayMs);
          return;
        }
        const data = (await res.json()) as {
          projectId?: string;
          fingerprint?: string;
          inflightCount?: number;
        };
        if (data.projectId !== projectId) {
          nextDelayMs = IDLE_POLL_MS;
          schedule(nextDelayMs);
          return;
        }

        nextDelayMs =
          (data.inflightCount ?? 0) > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;

        if (
          data.fingerprint &&
          data.fingerprint !== lastFingerprintRef.current
        ) {
          lastFingerprintRef.current = data.fingerprint;
          const detail: CanvasTaskPanelSyncDetail = {
            projectId,
            terminal: (data.inflightCount ?? 0) === 0,
          };
          notifyCanvasTaskPanelSync(detail);
        }
      } catch {
        nextDelayMs = ERROR_BACKOFF_MS;
      } finally {
        window.clearTimeout(timeoutId);
        inFlightRef.current = false;
        schedule(nextDelayMs);
      }
    };

    void tick();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        schedule(500);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [base, projectId, enabled]);
}
