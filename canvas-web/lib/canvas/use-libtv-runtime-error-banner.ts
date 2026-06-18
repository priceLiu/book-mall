"use client";

import { useCallback, useEffect, useState } from "react";
import { useCanvasStore } from "./store";
import type { CanvasNodeRuntime } from "./types";

/** LibTV 媒体节点 · 生成失败条默认自动收起时长 */
export const LIBTV_RUNTIME_ERROR_AUTO_DISMISS_MS = 12_000;

export function useLibtvRuntimeErrorBanner(opts: {
  nodeId: string;
  status?: CanvasNodeRuntime["status"];
  failCode?: string;
  failMessage?: string;
  autoDismissMs?: number;
}) {
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const dismiss = useCallback(() => {
    setVisible(false);
    const node = useCanvasStore.getState().nodes.find((n) => n.id === opts.nodeId);
    const rt = (node?.data as { runtime?: CanvasNodeRuntime } | undefined)?.runtime;
    if (rt?.status !== "error") return;
    const hasMedia = Boolean(rt.ossUrl?.trim() || rt.ephemeralUrl?.trim());
    setNodeRuntime(opts.nodeId, {
      status: hasMedia ? "done" : "idle",
      failCode: undefined,
      failMessage: undefined,
    });
  }, [opts.nodeId, setNodeRuntime]);

  useEffect(() => {
    if (opts.status === "pending" || opts.status === "running") {
      setVisible(false);
      return;
    }
    const msg = opts.failMessage?.trim() ?? "";
    if (opts.status !== "error" || !msg) {
      setVisible(false);
      setMessage("");
      return;
    }
    setMessage(msg);
    setVisible(true);
    const timer = window.setTimeout(
      () => dismiss(),
      opts.autoDismissMs ?? LIBTV_RUNTIME_ERROR_AUTO_DISMISS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [
    opts.status,
    opts.failCode,
    opts.failMessage,
    opts.autoDismissMs,
    dismiss,
  ]);

  return { visible, message, dismiss };
}
