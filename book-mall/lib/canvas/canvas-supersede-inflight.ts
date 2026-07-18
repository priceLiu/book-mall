/**
 * forceFresh 重生成：终止同节点同 scope 的旧在飞任务，并收口关联 Gateway 日志，避免
 * 「画布只显示最新 3 条、Gateway 后台仍 5 条 RUNNING」的重复扣费风险。
 */
import type { Prisma } from "@prisma/client";

import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";
import { GENERATION_INFLIGHT_STATUSES } from "@/lib/generation/traffic-control/constants";
import { releaseGatewayVideoTrafficSlotIfOccupying } from "@/lib/generation/traffic-control/release-gateway-video-traffic-slot";
import { releaseTrafficSlot } from "@/lib/generation/traffic-control/slot";

import {
  extractStoryScopeFromInputPayload,
  storyScopesConflict,
  type CanvasTaskStoryScope,
} from "./canvas-story-scope";

export const CANVAS_SUPERSEDED_FAIL_CODE = "SUPERSEDED";
export const CANVAS_SUPERSEDED_FAIL_MESSAGE =
  "用户在同一节点发起了新的生成，本任务已终止（避免重复扣费）";

export type SupersededCanvasTaskSnapshot = {
  id: string;
  status: string;
  inputPayload: unknown;
};

function taskPayload(inputPayload: unknown): Record<string, unknown> {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return {};
  }
  return inputPayload as Record<string, unknown>;
}

/** 事务内：将冲突 scope 的旧在飞 canvas 任务标为 FAILED(SUPERSEDED)。 */
export async function supersedeCanvasInflightTasksInTx(
  tx: Prisma.TransactionClient,
  args: {
    projectId: string;
    nodeId: string;
    storyScope?: CanvasTaskStoryScope;
  },
): Promise<SupersededCanvasTaskSnapshot[]> {
  const active = await tx.canvasGenerationTask.findMany({
    where: {
      projectId: args.projectId,
      nodeId: args.nodeId,
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
      deletedAt: null,
    },
    select: { id: true, status: true, inputPayload: true },
  });

  const toSupersede = active.filter((t) => {
    const existingScope = extractStoryScopeFromInputPayload(t.inputPayload);
    return storyScopesConflict(args.storyScope, existingScope);
  });
  if (!toSupersede.length) return [];

  const now = new Date();
  for (const t of toSupersede) {
    await tx.canvasGenerationTask.updateMany({
      where: {
        id: t.id,
        status: { in: [...GENERATION_INFLIGHT_STATUSES] },
      },
      data: {
        status: "FAILED",
        failCode: CANVAS_SUPERSEDED_FAIL_CODE,
        failMessage: CANVAS_SUPERSEDED_FAIL_MESSAGE,
        completedAt: now,
        lastPolledAt: now,
      },
    });
  }

  return toSupersede;
}

async function failGatewayLogIfActive(input: {
  logId: string;
  externalTaskId?: string | null;
}): Promise<void> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: input.logId },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      externalTaskId: true,
    },
  });
  if (!log || (log.status !== "RUNNING" && log.status !== "PENDING")) return;

  const durationMs = log.submittedAt
    ? Math.max(0, Date.now() - log.submittedAt.getTime())
    : 0;
  await finalizeRequestLog(log.id, {
    status: "FAILED",
    durationMs,
    failCode: CANVAS_SUPERSEDED_FAIL_CODE,
    failMessage: CANVAS_SUPERSEDED_FAIL_MESSAGE,
    externalTaskId:
      input.externalTaskId?.trim() ||
      log.externalTaskId?.trim() ||
      undefined,
  }).catch(() => undefined);
}

/** 事务外：释放交通槽并收口仍 RUNNING 的 Gateway 日志。 */
export async function cleanupSupersededCanvasTaskSideEffects(
  tasks: SupersededCanvasTaskSnapshot[],
): Promise<void> {
  for (const t of tasks) {
    const payload = taskPayload(t.inputPayload);
    const scopeKey =
      typeof payload.trafficScopeKey === "string"
        ? payload.trafficScopeKey.trim()
        : "";

    if (t.status === "DISPATCHING" && scopeKey) {
      await releaseTrafficSlot(scopeKey).catch(() => undefined);
    }

    const gatewayLogId =
      typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";
    if (gatewayLogId) {
      await failGatewayLogIfActive({ logId: gatewayLogId });
      await releaseGatewayVideoTrafficSlotIfOccupying({
        logId: gatewayLogId,
        scopeKey: scopeKey || undefined,
        fireDispatch: true,
      }).catch(() => undefined);
      continue;
    }

    const orphanLog = await prisma.gatewayRequestLog.findFirst({
      where: {
        storyTaskId: t.id,
        status: { in: ["RUNNING", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, externalTaskId: true },
    });
    if (!orphanLog) continue;

    await failGatewayLogIfActive({
      logId: orphanLog.id,
      externalTaskId: orphanLog.externalTaskId,
    });
    await releaseGatewayVideoTrafficSlotIfOccupying({
      logId: orphanLog.id,
      scopeKey: scopeKey || undefined,
      fireDispatch: true,
    }).catch(() => undefined);
  }
}
