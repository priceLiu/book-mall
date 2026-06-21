/** LibTV / sbv1 / Pro2 · 运行时失败弹窗：同浏览器标签页内只弹一次（刷新不重复） */

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
