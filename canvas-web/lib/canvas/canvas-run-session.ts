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

/** Pro2 剧本 Hub · 单次 LLM 含多轮校验重试，宽限须覆盖整段异步执行 */
export const PRO2_SCRIPT_HUB_ORPHAN_RECONCILE_GRACE_MS = 8 * 60 * 1000;

export function clearCanvasNodeRunSession(nodeId: string): void {
  sessionStartedNodeIds.delete(nodeId);
  sessionStartedAtMs.delete(nodeId);
}

export function isCanvasNodeRunSessionActive(nodeId: string): boolean {
  return sessionStartedNodeIds.has(nodeId);
}

export function canvasNodeRunSessionStartedAtMs(nodeId: string): number {
  return sessionStartedAtMs.get(nodeId) ?? 0;
}

/** 本地 pending 尚无 taskId 时 · 勿被 reconcile 误清（runOne / Gateway 提交窗口） */
const LIBTV_ORPHAN_RECONCILE_GRACE_MS = 60_000;

export function shouldDeferLibtvOrphanReconcile(
  nodeId: string,
  opts?: { extendedGraceMs?: number },
): boolean {
  if (!nodeId || !sessionStartedNodeIds.has(nodeId)) return false;
  const startedAt = sessionStartedAtMs.get(nodeId) ?? 0;
  const graceMs = opts?.extendedGraceMs ?? LIBTV_ORPHAN_RECONCILE_GRACE_MS;
  if (!startedAt) return true;
  return Date.now() - startedAt < graceMs;
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
  if (localSt !== "pending" && localSt !== "running" && localSt !== "queued") {
    return false;
  }
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

  if (!sessionStartedNodeIds.has(nodeId)) {
    // 刷新后会话丢失：服务端已终态时仍应写回，避免 Gateway 已成功但 UI 一直「生成中」
    if (isTerminalTaskStatus(pick.status)) return false;
    return true;
  }

  const startedAt = sessionStartedAtMs.get(nodeId) ?? 0;
  const pickMs = Date.parse(pick.updatedAt || pick.createdAt || "");
  if (Number.isFinite(pickMs) && pickMs >= startedAt - 3000) return false;
  return true;
}
