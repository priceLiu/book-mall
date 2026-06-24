/** LibTV / sbv1 / Pro2 · 运行时失败弹窗：同浏览器标签页内只弹一次（刷新不重复） */

import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "canvas-libtv-error-alert:";

export function buildLibtvRuntimeErrorAlertKey(input: {
  scope: string;
  nodeId: string;
  taskId?: string;
  failCode?: string;
  failMessage?: string;
}): string {
  const msg = input.failMessage?.trim().slice(0, 160) ?? "";
  return `${STORAGE_PREFIX}${input.scope}:${input.nodeId}:${input.taskId ?? ""}:${input.failCode ?? ""}:${msg}`;
}

export function wasLibtvRuntimeErrorAlertShown(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markLibtvRuntimeErrorAlertShown(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* quota / private mode */
  }
}

export function shouldShowLibtvRuntimeErrorAlert(input: {
  taskId?: string;
  dismissedFailTaskId?: string;
  storageKey: string;
}): boolean {
  const taskId = input.taskId?.trim();
  if (taskId && input.dismissedFailTaskId?.trim() === taskId) return false;
  return !wasLibtvRuntimeErrorAlertShown(input.storageKey);
}

export function libtvRuntimeErrorAlertScope(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

export function libtvRuntimeErrorAlertTitle(
  failCode?: string,
  message?: string,
): string {
  const code = failCode?.trim();
  const msg = message ?? "";
  if (
    code === "INSUFFICIENT_CREDITS" ||
    msg.includes("积分不足") ||
    msg.includes("积分不够")
  ) {
    return "积分不足";
  }
  return "视频生成失败";
}

/**
 * 仅在本次会话内「生成中 → 失败」时弹窗；进页已存在的历史 error 不弹（避免充值后仍被旧状态打扰）。
 */
export function useLibtvRuntimeErrorAlert(opts: {
  nodeId: string;
  status?: string;
  taskId?: string;
  failCode?: string;
  failMessage?: string;
  dismissedFailTaskId?: string;
  enabled?: boolean;
  onAlert: (payload: { message: string; failCode?: string }) => void;
}): void {
  const isFirstPaintRef = useRef(true);
  const prevStatusRef = useRef<string | undefined>(undefined);
  const lastAlertedRef = useRef<string | null>(null);
  const onAlertRef = useRef(opts.onAlert);
  onAlertRef.current = opts.onAlert;

  useEffect(() => {
    if (opts.enabled === false) return;

    const status = opts.status;
    if (isFirstPaintRef.current) {
      isFirstPaintRef.current = false;
      prevStatusRef.current = status;
      return;
    }

    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status !== "error") return;
    if (prev !== "pending" && prev !== "running") return;

    const msg = opts.failMessage?.trim();
    if (!msg) return;

    const taskId = opts.taskId?.trim();
    const storageKey = buildLibtvRuntimeErrorAlertKey({
      scope: libtvRuntimeErrorAlertScope(),
      nodeId: opts.nodeId,
      taskId,
      failCode: opts.failCode,
      failMessage: msg,
    });
    if (
      !shouldShowLibtvRuntimeErrorAlert({
        taskId,
        dismissedFailTaskId: opts.dismissedFailTaskId,
        storageKey,
      })
    ) {
      return;
    }
    if (lastAlertedRef.current === storageKey) return;
    lastAlertedRef.current = storageKey;
    markLibtvRuntimeErrorAlertShown(storageKey);
    onAlertRef.current({ message: msg, failCode: opts.failCode });
  }, [
    opts.enabled,
    opts.nodeId,
    opts.status,
    opts.taskId,
    opts.failCode,
    opts.failMessage,
    opts.dismissedFailTaskId,
  ]);
}
