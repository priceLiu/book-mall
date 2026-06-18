"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "./store";
import type { CanvasNodeRuntime } from "./types";

/** LibTV 媒体节点 · 生成失败条默认自动收起时长 */
export const LIBTV_RUNTIME_ERROR_AUTO_DISMISS_MS = 12_000;

export function useLibtvRuntimeErrorBanner(opts: {
  nodeId: string;
  status?: CanvasNodeRuntime["status"];
  taskId?: string;
  failCode?: string;
  failMessage?: string;
  dismissedFailTaskId?: string;
  autoDismissMs?: number;
}) {
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const dismissedLocallyRef = useRef<string | null>(null);

  const dismiss = useCallback(() => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === opts.nodeId);
    const rt = (node?.data as { runtime?: CanvasNodeRuntime } | undefined)?.runtime;
    if (rt?.taskId) dismissedLocallyRef.current = rt.taskId;
    setVisible(false);
    if (rt?.status !== "error") return;
    const hasMedia = Boolean(rt.ossUrl?.trim() || rt.ephemeralUrl?.trim());
    setNodeRuntime(opts.nodeId, {
      status: hasMedia ? "done" : "idle",
      failCode: undefined,
      failMessage: undefined,
      dismissedFailTaskId: rt.taskId,
    });
  }, [opts.nodeId, setNodeRuntime]);

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (opts.status === "pending" || opts.status === "running") {
      dismissedLocallyRef.current = null;
      setVisible(false);
      return;
    }
    const msg = opts.failMessage?.trim() ?? "";
    if (opts.status !== "error" || !msg) {
      setVisible(false);
      setMessage("");
      return;
    }
    const taskId = opts.taskId?.trim() ?? "";
    if (
      (taskId && opts.dismissedFailTaskId === taskId) ||
      (taskId && dismissedLocallyRef.current === taskId)
    ) {
      setVisible(false);
      return;
    }
    setMessage(msg);
    setVisible(true);
    const timer = window.setTimeout(
      () => dismissRef.current(),
      opts.autoDismissMs ?? LIBTV_RUNTIME_ERROR_AUTO_DISMISS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [
    opts.status,
    opts.taskId,
    opts.failCode,
    opts.failMessage,
    opts.dismissedFailTaskId,
    opts.autoDismissMs,
  ]);

  return { visible, message, dismiss };
}
