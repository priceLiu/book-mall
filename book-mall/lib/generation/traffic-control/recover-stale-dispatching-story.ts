import type { Prisma, StoryGenerationTask } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { getDispatchingStaleSec } from "./constants";
import { queueDispatchAfterFromIndex } from "./queue-dispatch-after";
import {
  clearDispatchStaleRetryInPayload,
  failStoryTaskPreSubmitTimeout,
  isPreSubmitRetryExhausted,
  nextDispatchStaleRetryPayload,
} from "./pre-submit-retry";
import { releaseTrafficSlot } from "./slot";
import { resolveStoryProjectTrafficScope } from "./scope-key";
import { releaseGatewayVideoTrafficSlotIfOccupying } from "./release-gateway-video-traffic-slot";

function taskInputPayload(
  task: Pick<StoryGenerationTask, "inputPayload">,
): Record<string, unknown> {
  const p = task.inputPayload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as Record<string, unknown>;
}

function stalePreSubmitCutoff(): Date {
  return new Date(Date.now() - getDispatchingStaleSec() * 1000);
}

function storyFrameVideoWhere(
  projectId: string | undefined,
): Prisma.StoryGenerationTaskWhereInput {
  return {
    kind: "FRAME_VIDEO",
    ...(projectId ? { projectId } : {}),
  };
}

function staleStoryDispatchingWhere(
  projectId: string | undefined,
  cutoff: Date,
): Prisma.StoryGenerationTaskWhereInput {
  return {
    status: "DISPATCHING",
    ...storyFrameVideoWhere(projectId),
    OR: [
      { updatedAt: { lt: cutoff } },
      { kieTaskId: null, queuedAt: { lt: cutoff } },
      { kieTaskId: null, queuedAt: null, createdAt: { lt: cutoff } },
    ],
  };
}

function staleStoryQueuedWhere(
  projectId: string | undefined,
  cutoff: Date,
): Prisma.StoryGenerationTaskWhereInput {
  const now = new Date();
  return {
    status: "QUEUED",
    ...storyFrameVideoWhere(projectId),
    AND: [
      {
        OR: [
          { queuedAt: { lt: cutoff } },
          { queuedAt: null, createdAt: { lt: cutoff } },
        ],
      },
      {
        OR: [{ dispatchAfter: null }, { dispatchAfter: { lte: now } }],
      },
    ],
  };
}

async function promoteStoryDispatchingWithGatewayLog(
  task: Pick<
    StoryGenerationTask,
    "id" | "projectId" | "actorUserId" | "inputPayload" | "gatewayLogId"
  > & { project: { userId: string } },
  gatewayLogId: string,
  payload: Record<string, unknown>,
  scopeKey: string,
): Promise<boolean> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: { id: true, status: true, externalTaskId: true },
  });
  if (!log || log.status === "FAILED") return false;

  const vendorTaskId = log.externalTaskId?.trim();
  if (!vendorTaskId) return false;

  const updated = await prisma.storyGenerationTask.updateMany({
    where: { id: task.id, status: "DISPATCHING" },
    data: {
      status: "SUBMITTED",
      kieTaskId: vendorTaskId,
      gatewayLogId,
      submittedAt: new Date(),
      lastPolledAt: new Date(),
      inputPayload: clearDispatchStaleRetryInPayload(payload) as Prisma.InputJsonValue,
    },
  });
  if (updated.count === 0) return false;

  await releaseGatewayVideoTrafficSlotIfOccupying({
    logId: gatewayLogId,
    scopeKey,
    fireDispatch: true,
  }).catch(() => undefined);
  return true;
}

async function recoverStaleStoryQueuedTasks(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<number> {
  const cutoff = stalePreSubmitCutoff();
  const stale = await prisma.storyGenerationTask.findMany({
    where: staleStoryQueuedWhere(opts?.projectId, cutoff),
    select: { id: true, inputPayload: true },
    orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
    take: opts?.limit ?? 20,
  });

  let n = 0;
  for (const t of stale) {
    const payload = taskInputPayload(t);
    if (isPreSubmitRetryExhausted(payload)) {
      await failStoryTaskPreSubmitTimeout(t.id, payload);
      n++;
      continue;
    }
    const { payload: nextPayload } = nextDispatchStaleRetryPayload(payload);
    await prisma.storyGenerationTask.update({
      where: { id: t.id },
      data: {
        dispatchAfter: queueDispatchAfterFromIndex(0),
        failCode: null,
        failMessage: null,
        inputPayload: nextPayload as Prisma.InputJsonValue,
      },
    });
    n++;
  }
  return n;
}

async function recoverStaleStoryDispatchingOnly(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<number> {
  const cutoff = stalePreSubmitCutoff();
  const stale = await prisma.storyGenerationTask.findMany({
    where: staleStoryDispatchingWhere(opts?.projectId, cutoff),
    select: {
      id: true,
      projectId: true,
      actorUserId: true,
      inputPayload: true,
      kieTaskId: true,
      gatewayLogId: true,
      project: { select: { userId: true } },
    },
    orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
    take: opts?.limit ?? 20,
  });

  let n = 0;
  for (const t of stale) {
    const payload = taskInputPayload(t);
    const gwId = t.gatewayLogId?.trim() ?? "";

    const scope = await resolveStoryProjectTrafficScope(
      t.projectId,
      t.actorUserId ?? t.project.userId,
    );

    if (gwId) {
      const promoted = await promoteStoryDispatchingWithGatewayLog(
        t,
        gwId,
        payload,
        scope.scopeKey,
      );
      if (promoted) {
        n++;
        continue;
      }
    }

    if (isPreSubmitRetryExhausted(payload)) {
      await releaseTrafficSlot(scope.scopeKey);
      await failStoryTaskPreSubmitTimeout(t.id, payload);
      n++;
      continue;
    }

    await releaseTrafficSlot(scope.scopeKey);
    const { payload: nextPayload } = nextDispatchStaleRetryPayload(payload);
    await prisma.storyGenerationTask.update({
      where: { id: t.id, status: "DISPATCHING" },
      data: {
        status: "QUEUED",
        dispatchAfter: queueDispatchAfterFromIndex(n),
        failCode: null,
        failMessage: null,
        inputPayload: nextPayload as Prisma.InputJsonValue,
      },
    });
    n++;
  }
  return n;
}

/** 漫剧 FRAME_VIDEO · 与 canvas 同口径的 pre-submit 自动释放 + 重排 */
export async function recoverStaleDispatchingStoryTasks(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<number> {
  const limit = opts?.limit ?? 20;
  const dispatching = await recoverStaleStoryDispatchingOnly({ ...opts, limit });
  const queued = await recoverStaleStoryQueuedTasks({ ...opts, limit });
  return dispatching + queued;
}
