/**
 * Canvas 视频「提交超时但其实成功」孤儿日志对账。
 *
 * 派发时 createTask 的 HTTP 调用若超过 DISPATCH_SUBMIT_TIMEOUT_MS 被放弃，
 * 那次请求往往仍在厂商侧成功（建了 vendor 任务 + GatewayRequestLog），
 * 但 task 没记到 gatewayLogId/kieTaskId → 自愈重派 → 第二次 createTask → 重复扣费 + 假性失败。
 *
 * dispatch 时把 task.id 写进 GatewayRequestLog.storyTaskId（复用既有字段，无需迁移），
 * 之后凭它找回孤儿日志并 promote，避免重复提交。
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runTxWithRetry } from "@/lib/db-tx-retry";

import { clearDispatchStaleRetryInPayload } from "./pre-submit-retry";
import { releaseGatewayVideoTrafficSlotIfOccupying } from "./release-gateway-video-traffic-slot";

/** 找此 canvas 任务「已建厂商任务但未回写」的孤儿日志（externalTaskId 已就绪、非 FAILED）。 */
export async function findPromotableCanvasGatewayLog(
  taskId: string,
): Promise<{ logId: string; externalTaskId: string } | null> {
  const log = await prisma.gatewayRequestLog.findFirst({
    where: {
      storyTaskId: taskId,
      status: { not: "FAILED" },
      externalTaskId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, externalTaskId: true },
  });
  const ext = log?.externalTaskId?.trim();
  if (!log || !ext) return null;
  return { logId: log.id, externalTaskId: ext };
}

/**
 * 把 DISPATCHING 的 canvas 任务按已存在的厂商日志 promote 成 SUBMITTED（绝不再次 createTask）。
 * 与正常成功路径同口径：promote 成功后 releaseGatewayVideoTrafficSlotIfOccupying 放槽 + fireDispatch。
 */
export async function promoteCanvasTaskFromGatewayLog(args: {
  taskId: string;
  payload: Record<string, unknown>;
  logId: string;
  externalTaskId: string;
  scopeKey: string;
}): Promise<boolean> {
  const updated = await runTxWithRetry(
    () =>
      prisma.canvasGenerationTask.updateMany({
        where: { id: args.taskId, status: "DISPATCHING" },
        data: {
          status: "SUBMITTED",
          kieTaskId: args.externalTaskId,
          submittedAt: new Date(),
          lastPolledAt: new Date(),
          inputPayload: clearDispatchStaleRetryInPayload({
            ...args.payload,
            gatewayLogId: args.logId,
            gatewayKieSubmitClaimed: true,
            syncGatewaySubmit: true,
            trafficScopeKey: args.scopeKey,
          }) as Prisma.InputJsonValue,
        },
      }),
    { label: "canvas-promote-orphan-log", maxRetries: 5 },
  );
  if (updated.count === 0) return false;
  await releaseGatewayVideoTrafficSlotIfOccupying({
    logId: args.logId,
    scopeKey: args.scopeKey,
    fireDispatch: true,
  }).catch(() => undefined);
  return true;
}
