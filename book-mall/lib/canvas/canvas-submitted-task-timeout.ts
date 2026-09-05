/**
 * 画布 SUBMITTED 视频任务 · 超时窗口（含 ≥15min 后台生成延长）。
 */
import type { CanvasGenerationTask } from "@prisma/client";

import {
  getCanvasBackgroundVideoTimeoutMin,
  isCanvasAsyncVideoEngineTaskPayload,
  resolveCanvasSubmittedTaskTimeoutMin,
  resolveCanvasSubmittedTaskTimeoutMs,
} from "@/lib/canvas/canvas-constants";
import {
  readVideoBackgroundGeneration,
} from "@/lib/gateway/video-background-generation";
import { VIDEO_BACKGROUND_UI_MS } from "@/lib/gateway/video-task-wait-policy";
import { prisma } from "@/lib/prisma";

export type CanvasSubmittedTaskTimeoutContext = {
  timeoutMs: number;
  timeoutMin: number;
  inBackground: boolean;
};

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> | null {
  if (!task.inputPayload || typeof task.inputPayload !== "object") return null;
  return task.inputPayload as Record<string, unknown>;
}

export async function resolveCanvasSubmittedTaskTimeoutContext(
  task: Pick<
    CanvasGenerationTask,
    "inputPayload" | "submittedAt" | "createdAt"
  >,
  nowMs: number = Date.now(),
): Promise<CanvasSubmittedTaskTimeoutContext> {
  const payload = taskInputPayload(task);
  const isAsyncVideo = isCanvasAsyncVideoEngineTaskPayload(payload);
  let inBackground = false;

  if (isAsyncVideo) {
    const submittedTs = (task.submittedAt ?? task.createdAt).getTime();
    if (nowMs - submittedTs >= VIDEO_BACKGROUND_UI_MS) {
      inBackground = true;
    }

    const gatewayLogId =
      typeof payload?.gatewayLogId === "string"
        ? payload.gatewayLogId.trim()
        : "";
    if (gatewayLogId) {
      const log = await prisma.gatewayRequestLog.findUnique({
        where: { id: gatewayLogId },
        select: { resultSummary: true },
      });
      if (readVideoBackgroundGeneration(log?.resultSummary)?.slotReleased) {
        inBackground = true;
      }
    }
  }

  if (inBackground) {
    const min = getCanvasBackgroundVideoTimeoutMin();
    return { timeoutMs: min * 60_000, timeoutMin: min, inBackground: true };
  }

  return {
    timeoutMs: resolveCanvasSubmittedTaskTimeoutMs(task),
    timeoutMin: resolveCanvasSubmittedTaskTimeoutMin(task),
    inBackground: false,
  };
}

/** 后台生成中厂商仍在跑时，跳过 canvas 侧误杀超时。 */
export function shouldDeferCanvasBackgroundVideoTimeout(input: {
  inBackground: boolean;
  cause: string;
}): boolean {
  if (!input.inBackground) return false;
  return (
    input.cause === "vendor_still_running" ||
    input.cause === "gateway_stuck_running"
  );
}
