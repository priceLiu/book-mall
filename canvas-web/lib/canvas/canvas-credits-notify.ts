import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { showCanvasCreditsToast } from "@/components/canvas/canvas-credits-toast-host";

const shownTaskIds = new Set<string>();

/** 生成成功且 PLATFORM 扣费时，弹出一次性积分提示 */
export function maybeNotifyCanvasCreditsSettled(task: CanvasTaskRecord): void {
  if (task.status !== "SUCCEEDED") return;
  if (shownTaskIds.has(task.id)) return;
  shownTaskIds.add(task.id);
  if (shownTaskIds.size > 200) {
    shownTaskIds.clear();
    shownTaskIds.add(task.id);
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
