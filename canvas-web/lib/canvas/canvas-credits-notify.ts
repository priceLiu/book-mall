import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { showCanvasCreditsToast } from "@/components/canvas/canvas-credits-toast-host";

const shownTaskIds = new Set<string>();
const lastStatus = new Map<string, string>();
/** 本页会话内见过「进行中」态的任务 */
const sessionInflightTaskIds = new Set<string>();
/** 本页会话内用户触发的生成（runOne 开始时登记 nodeId） */
const sessionStartedNodeIds = new Set<string>();

const INFLIGHT_STATUSES = new Set([
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
]);

/** 用户点击生成后登记，用于同步返回 SUCCEEDED 时仍能弹积分提示 */
export function markCanvasNodeGenerationStarted(nodeId: string): void {
  if (!nodeId) return;
  sessionStartedNodeIds.add(nodeId);
}

function markTaskInflight(taskId: string): void {
  if (!taskId) return;
  sessionInflightTaskIds.add(taskId);
}

function isLiveCreditsSettle(task: CanvasTaskRecord, prev: string | undefined): boolean {
  if (sessionInflightTaskIds.has(task.id)) return true;
  if (sessionStartedNodeIds.has(task.nodeId)) return true;
  if (prev !== undefined && prev !== "SUCCEEDED") return true;
  return false;
}

/** 生成成功且 PLATFORM 扣费时，弹出一次性积分提示（仅本次会话内新完成，刷新不重弹） */
export function maybeNotifyCanvasCreditsSettled(task: CanvasTaskRecord): void {
  const prev = lastStatus.get(task.id);
  lastStatus.set(task.id, task.status);

  if (INFLIGHT_STATUSES.has(task.status)) {
    markTaskInflight(task.id);
    return;
  }

  if (task.status !== "SUCCEEDED") return;
  if (shownTaskIds.has(task.id)) return;

  if (!isLiveCreditsSettle(task, prev)) {
    shownTaskIds.add(task.id);
    return;
  }

  shownTaskIds.add(task.id);
  sessionInflightTaskIds.delete(task.id);
  sessionStartedNodeIds.delete(task.nodeId);

  if (shownTaskIds.size > 400) {
    shownTaskIds.clear();
    lastStatus.clear();
    shownTaskIds.add(task.id);
    lastStatus.set(task.id, task.status);
  }

  if (task.billingMode === "BYOK") {
    if (task.creditsCharged != null && task.creditsCharged > 0) {
      showCanvasCreditsToast(`超额编排消耗 ${task.creditsCharged} 积分`);
    }
    return;
  }

  if (task.creditsCharged != null && task.creditsCharged > 0) {
    showCanvasCreditsToast(`本次消耗 ${task.creditsCharged} 积分`);
  }
}
