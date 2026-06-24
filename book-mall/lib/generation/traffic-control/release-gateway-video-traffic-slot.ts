import type { Prisma } from "@prisma/client";

import {
  attachGatewayTrafficSlotReleased,
  isGatewayVideoLogOccupyingTrafficSlot,
} from "@/lib/gateway/video-background-generation";
import { prisma } from "@/lib/prisma";

import { releaseTrafficSlot, releaseTrafficSlotFromGatewayLog } from "./slot";

/**
 * 幂等释放 Gateway 视频 log 占用的交通槽。
 * - SUBMITTED 后立即调用：缩短「出队前」，maxConcurrency 只限制派发管线而非长 RUNNING 任务。
 * - finalize / 10min promote 再次调用时：已释放则 no-op，避免 runningVideoCount 双减。
 */
export async function releaseGatewayVideoTrafficSlotIfOccupying(input: {
  logId: string;
  scopeKey?: string | null;
  fireDispatch?: boolean;
  nowMs?: number;
}): Promise<boolean> {
  const nowMs = input.nowMs ?? Date.now();
  const row = await prisma.gatewayRequestLog.findUnique({
    where: { id: input.logId },
    select: {
      id: true,
      status: true,
      requestKind: true,
      resultSummary: true,
      tenantId: true,
      actorBookUserId: true,
      userId: true,
    },
  });
  if (!row || row.requestKind !== "VIDEO") return false;
  if (
    !isGatewayVideoLogOccupyingTrafficSlot({
      status: row.status,
      requestKind: row.requestKind,
      resultSummary: row.resultSummary,
    })
  ) {
    return false;
  }

  const nextSummary = attachGatewayTrafficSlotReleased(row.resultSummary, nowMs);
  await prisma.gatewayRequestLog.updateMany({
    where: { id: row.id, status: row.status },
    data: { resultSummary: nextSummary as Prisma.InputJsonValue },
  });

  const scopeKey = input.scopeKey?.trim();
  if (scopeKey) {
    await releaseTrafficSlot(scopeKey);
  } else {
    await releaseTrafficSlotFromGatewayLog(row);
  }

  if (input.fireDispatch) {
    const { fireVideoTrafficDispatchBacklog } = await import("./fire-canvas-dispatch");
    fireVideoTrafficDispatchBacklog("gateway-slot-released");
  }

  return true;
}
