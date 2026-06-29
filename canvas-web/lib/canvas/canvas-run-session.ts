import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasNodeRuntime } from "./types";

const sessionStartedNodeIds = new Set<string>();
const sessionStartedAtMs = new Map<string, number>();

function isServerInflightTaskStatus(status: string): boolean {
  return (
    status === "QUEUED" ||
    status === "DISPATCHING" ||
    status === "PENDING" ||
    status === "SUBMITTED"
  );
}

/** 用户点击生成后立即登记（早于 runOne），供任务对齐逻辑识别「本轮会话」 */
export function markCanvasNodeRunSession(nodeId: string): void {
  if (!nodeId) return;
  sessionStartedNodeIds.add(nodeId);
  sessionStartedAtMs.set(nodeId, Date.now());
}

export function clearCanvasNodeRunSession(nodeId: string): void {
  sessionStartedNodeIds.delete(nodeId);
  sessionStartedAtMs.delete(nodeId);
}

export function isCanvasNodeRunSessionActive(nodeId: string): boolean {
  return sessionStartedNodeIds.has(nodeId);
}

/** 本地 pending 尚无 taskId 时 · 勿被 reconcile 误清（runOne / Gateway 提交窗口） */
const LIBTV_ORPHAN_RECONCILE_GRACE_MS = 120_000;

export function shouldDeferLibtvOrphanReconcile(nodeId: string): boolean {
  if (!nodeId || !sessionStartedNodeIds.has(nodeId)) return false;
  const startedAt = sessionStartedAtMs.get(nodeId) ?? 0;
  if (!startedAt) return true;
  return Date.now() - startedAt < LIBTV_ORPHAN_RECONCILE_GRACE_MS;
}

function isTerminalTaskStatus(status: string): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
}

/**
 * 本地 pending/running 时，勿用「上一轮」服务端任务（终态或 stale 在途）覆盖乐观 UI。
 * 刚点击、尚未绑定 taskId 时尤其如此（否则会闪回空态/旧成片或旧 queued，数秒后才恢复）。
 */
export function shouldSkipStaleTerminalWhileLocalInflight(
  nodeId: string,
  localRuntime: CanvasNodeRuntime | undefined,
  pick: CanvasTaskRecord,
): boolean {
  const localSt = localRuntime?.status;
  if (localSt !== "pending" && localSt !== "running") return false;
  if (
    !isServerInflightTaskStatus(pick.status) &&
    !isTerminalTaskStatus(pick.status)
  ) {
    return false;
  }

  const localTaskId = localRuntime?.taskId?.trim();
  if (localTaskId) {
    if (pick.id === localTaskId) return false;
    return true;
  }

  if (!sessionStartedNodeIds.has(nodeId)) return true;

  const startedAt = sessionStartedAtMs.get(nodeId) ?? 0;
  const pickMs = Date.parse(pick.updatedAt || pick.createdAt || "");
  if (Number.isFinite(pickMs) && pickMs >= startedAt - 3000) return false;
  return true;
}
