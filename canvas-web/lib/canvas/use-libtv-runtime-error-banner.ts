"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "./store";
import type { CanvasNodeRuntime } from "./types";
import {
  buildLibtvRuntimeErrorAlertKey,
  libtvRuntimeErrorAlertScope,
  markLibtvRuntimeErrorAlertShown,
} from "./libtv-runtime-error-alert";
import { isMislabeledVendorSuccessError } from "./friendly-task-error";

/** @deprecated 错误条改为仅手动关闭，避免用户错过失败原因 */
export const LIBTV_RUNTIME_ERROR_AUTO_DISMISS_MS = 0;

export function useLibtvRuntimeErrorBanner(opts: {
  nodeId: string;
  status?: CanvasNodeRuntime["status"];
  taskId?: string;
  failCode?: string;
  failMessage?: string;
  dismissedFailTaskId?: string;
  autoDismissMs?: number;
  /** 节点已有成片 · 不展示错误条（避免 success 误标失败挡住视频） */
  hasMedia?: boolean;
}) {
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const dismissedLocallyRef = useRef<string | null>(null);

  const dismiss = useCallback(() => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === opts.nodeId);
    const rt = (node?.data as { runtime?: CanvasNodeRuntime } | undefined)?.runtime;
    if (rt?.taskId) dismissedLocallyRef.current = rt.taskId;
    const msg = rt?.failMessage?.trim();
    if (msg) {
      markLibtvRuntimeErrorAlertShown(
        buildLibtvRuntimeErrorAlertKey({
          scope: libtvRuntimeErrorAlertScope(),
          nodeId: opts.nodeId,
          taskId: rt?.taskId,
          failCode: rt?.failCode,
          failMessage: msg,
        }),
      );
    }
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
    if (
      opts.hasMedia ||
      opts.status !== "error" ||
      !msg ||
      isMislabeledVendorSuccessError(opts.failCode, msg) ||
      msg.includes("视频已生成但未写入节点")
    ) {
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
    const autoDismissMs = opts.autoDismissMs ?? LIBTV_RUNTIME_ERROR_AUTO_DISMISS_MS;
    if (autoDismissMs > 0) {
      const timer = window.setTimeout(() => dismissRef.current(), autoDismissMs);
      return () => window.clearTimeout(timer);
    }
  }, [
    opts.status,
    opts.taskId,
    opts.failCode,
    opts.failMessage,
    opts.dismissedFailTaskId,
    opts.autoDismissMs,
    opts.hasMedia,
  ]);

  return { visible, message, dismiss };
}
