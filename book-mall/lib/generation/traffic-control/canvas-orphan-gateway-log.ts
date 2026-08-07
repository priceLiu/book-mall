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

import {
  clearDispatchStaleRetryInPayload,
  SUBMIT_DISPATCH_TIMEOUT_FAIL_CODE,
} from "./pre-submit-retry";
import { releaseGatewayVideoTrafficSlotIfOccupying } from "./release-gateway-video-traffic-slot";
import { resolveCanvasProjectTrafficScope } from "./scope-key";

export type CanvasLinkedGatewayLog = {
  logId: string;
  externalTaskId: string | null;
  status: string;
};

const REVIVABLE_CANVAS_TASK_STATUSES: Prisma.CanvasGenerationTaskWhereInput[] = [
  { status: { in: ["DISPATCHING", "QUEUED"] } },
  {
    status: "FAILED",
    failCode: SUBMIT_DISPATCH_TIMEOUT_FAIL_CODE,
  },
];

export type CanvasGatewayLogRef = {
  logId: string;
  externalTaskId: string | null;
  status: string;
};

/** 任意非 FAILED 的 storyTaskId 关联日志（含 vendor taskId 尚未写入的 RUNNING）。 */
export async function findExistingCanvasGatewayLogForTask(
  taskId: string,
): Promise<CanvasGatewayLogRef | null> {
  const log = await prisma.gatewayRequestLog.findFirst({
    where: {
      storyTaskId: taskId,
      status: { not: "FAILED" },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, externalTaskId: true, status: true },
  });
  if (!log) return null;
  return {
    logId: log.id,
    externalTaskId: log.externalTaskId?.trim() ?? null,
    status: log.status,
  };
}

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
    orderBy: { createdAt: "asc" },
    select: { id: true, externalTaskId: true },
  });
  const ext = log?.externalTaskId?.trim();
  if (!log || !ext) return null;
  return { logId: log.id, externalTaskId: ext };
}

/**
 * dispatch 提交前：已有 Gateway 日志则 promote 或判定「首次提交仍在途」，绝不重复 createTask。
 */
export async function resolveCanvasGatewaySubmitCollision(args: {
  taskId: string;
  payload: Record<string, unknown>;
  scopeKey: string;
}): Promise<"proceed" | "dispatched" | "in_flight"> {
  const existing = await findExistingCanvasGatewayLogForTask(args.taskId);
  if (!existing) return "proceed";

  if (existing.externalTaskId) {
    const promoted = await promoteCanvasTaskFromGatewayLog({
      taskId: args.taskId,
      payload: args.payload,
      logId: existing.logId,
      externalTaskId: existing.externalTaskId,
      scopeKey: args.scopeKey,
    });
    return promoted ? "dispatched" : "in_flight";
  }

  return "in_flight";
}

/** 找 canvas 任务关联的 Gateway 日志（含仅有 logId、厂商 taskId 尚未写入的 RUNNING）。 */
export async function findCanvasLinkedGatewayLog(
  taskId: string,
): Promise<CanvasLinkedGatewayLog | null> {
  const promotable = await findPromotableCanvasGatewayLog(taskId);
  if (promotable) {
    return {
      logId: promotable.logId,
      externalTaskId: promotable.externalTaskId,
      status: "RUNNING",
    };
  }
  const log = await prisma.gatewayRequestLog.findFirst({
    where: {
      storyTaskId: taskId,
      status: { not: "FAILED" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, externalTaskId: true, status: true },
  });
  if (!log) return null;
  return {
    logId: log.id,
    externalTaskId: log.externalTaskId?.trim() ?? null,
    status: log.status,
  };
}

async function syncRevivedCanvasTaskFromGateway(taskId: string): Promise<void> {
  try {
    const { recoverCanvasKieImageFromGatewayForRead } = await import(
      "@/lib/canvas/canvas-kie-image-recover"
    );
    await recoverCanvasKieImageFromGatewayForRead(taskId);
  } catch {
    /* ignore */
  }
  try {
    const task = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
      select: { status: true, projectId: true },
    });
    if (task?.status === "SUBMITTED") {
      const { scheduleOpportunisticCanvasPoll } = await import(
        "@/lib/canvas/canvas-task-service"
      );
      scheduleOpportunisticCanvasPoll(task.projectId);
    }
  } catch {
    /* ignore */
  }
}

/** DISPATCHING / QUEUED / 假性 SUBMIT_DISPATCH_TIMEOUT → SUBMITTED，避免重复 createTask。 */
export async function reviveCanvasTaskFromGatewayLog(args: {
  taskId: string;
  payload: Record<string, unknown>;
  logId: string;
  externalTaskId?: string | null;
  scopeKey: string;
}): Promise<boolean> {
  const ext = args.externalTaskId?.trim() ?? "";
  const data: Prisma.CanvasGenerationTaskUpdateInput = {
    status: "SUBMITTED",
    submittedAt: new Date(),
    lastPolledAt: new Date(),
    failCode: null,
    failMessage: null,
    completedAt: null,
    inputPayload: clearDispatchStaleRetryInPayload({
      ...args.payload,
      gatewayLogId: args.logId,
      gatewayKieSubmitClaimed: true,
      syncGatewaySubmit: true,
      trafficScopeKey: args.scopeKey,
    }) as Prisma.InputJsonValue,
  };
  if (ext) data.kieTaskId = ext;

  const updated = await runTxWithRetry(
    () =>
      prisma.canvasGenerationTask.updateMany({
        where: {
          id: args.taskId,
          OR: REVIVABLE_CANVAS_TASK_STATUSES,
        },
        data,
      }),
    { label: "canvas-revive-orphan-log", maxRetries: 5 },
  );
  if (updated.count === 0) return false;

  await releaseGatewayVideoTrafficSlotIfOccupying({
    logId: args.logId,
    scopeKey: args.scopeKey,
    fireDispatch: true,
  }).catch(() => undefined);
  await syncRevivedCanvasTaskFromGateway(args.taskId);
  return true;
}

/** 终态失败前：若 Gateway 已有 RUNNING/SUCCEEDED 日志则恢复为 SUBMITTED，不写 FAILED。 */
export async function tryRecoverCanvasTaskBeforePreSubmitFail(args: {
  taskId: string;
  payload: Record<string, unknown>;
  scopeKey?: string;
}): Promise<boolean> {
  const linked = await findCanvasLinkedGatewayLog(args.taskId);
  if (!linked || linked.status === "FAILED") return false;

  let scopeKey = args.scopeKey?.trim();
  if (!scopeKey) {
    const task = await prisma.canvasGenerationTask.findUnique({
      where: { id: args.taskId },
      select: {
        projectId: true,
        actorUserId: true,
        project: { select: { userId: true } },
      },
    });
    if (!task) return false;
    const scope = await resolveCanvasProjectTrafficScope(
      task.projectId,
      task.actorUserId ?? task.project.userId,
    );
    scopeKey = scope.scopeKey;
  }

  return reviveCanvasTaskFromGatewayLog({
    taskId: args.taskId,
    payload: args.payload,
    logId: linked.logId,
    externalTaskId: linked.externalTaskId,
    scopeKey,
  });
}

function taskInputPayload(inputPayload: unknown): Record<string, unknown> {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return {};
  }
  return inputPayload as Record<string, unknown>;
}

/** 读路径 / poll：纠正已 FAILED(SUBMIT_DISPATCH_TIMEOUT) 但 Gateway 仍在跑的任务。 */
export async function recoverCanvasSubmitDispatchTimeoutTask(
  taskId: string,
): Promise<boolean> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: { status: true, failCode: true, inputPayload: true },
  });
  if (!task) return false;
  if (
    task.status !== "FAILED" ||
    task.failCode !== SUBMIT_DISPATCH_TIMEOUT_FAIL_CODE
  ) {
    return false;
  }
  return tryRecoverCanvasTaskBeforePreSubmitFail({
    taskId,
    payload: taskInputPayload(task.inputPayload),
  });
}

export async function recoverProjectSubmitDispatchTimeoutTasksForRead(
  tasks: Array<{ id: string; status: string; failCode: string | null }>,
  limit = 10,
): Promise<number> {
  let recovered = 0;
  const candidates = tasks
    .filter(
      (t) =>
        t.status === "FAILED" &&
        t.failCode === SUBMIT_DISPATCH_TIMEOUT_FAIL_CODE,
    )
    .slice(0, limit);
  for (const t of candidates) {
    if (await recoverCanvasSubmitDispatchTimeoutTask(t.id)) recovered += 1;
  }
  return recovered;
}

/**
 * 把 DISPATCHING 的 canvas 任务按已存在的厂商日志 promote 成 SUBMITTED（绝不再次 createTask）。
 * 与正常成功路径同口径：promote 成功后 releaseGatewayVideoTrafficSlotIfOccupying 放槽 + fireDispatch。
 */
/**
 * SUBMITTED 轮询前补全 gatewayLogId / kieTaskId（提交成功但 payload 未回写的孤儿对账）。
 * 凭 GatewayRequestLog.storyTaskId = canvas task id 找回，避免误判 GATEWAY_LEGACY_TASK。
 */
export async function backfillCanvasTaskGatewayLink(args: {
  taskId: string;
  kieTaskId: string | null;
  payload: Record<string, unknown>;
}): Promise<{
  payload: Record<string, unknown>;
  gatewayLogId: string;
  kieTaskId: string;
} | null> {
  let gatewayLogId =
    typeof args.payload.gatewayLogId === "string"
      ? args.payload.gatewayLogId.trim()
      : "";
  let kieTaskId = args.kieTaskId?.trim() ?? "";

  if (!gatewayLogId) {
    const orphan = await findPromotableCanvasGatewayLog(args.taskId);
    if (orphan) {
      gatewayLogId = orphan.logId;
      if (!kieTaskId) kieTaskId = orphan.externalTaskId;
    } else {
      const log = await prisma.gatewayRequestLog.findFirst({
        where: {
          storyTaskId: args.taskId,
          status: { not: "FAILED" },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, externalTaskId: true },
      });
      if (log?.id) {
        gatewayLogId = log.id;
        const ext = log.externalTaskId?.trim();
        if (ext && !kieTaskId) kieTaskId = ext;
      }
    }
  }

  if (!gatewayLogId) return null;

  const nextPayload = { ...args.payload, gatewayLogId };
  const data: Prisma.CanvasGenerationTaskUpdateInput = {
    inputPayload: nextPayload as Prisma.InputJsonValue,
  };
  if (kieTaskId && kieTaskId !== args.kieTaskId) {
    data.kieTaskId = kieTaskId;
  }
  const payloadChanged =
    gatewayLogId !==
    (typeof args.payload.gatewayLogId === "string"
      ? args.payload.gatewayLogId.trim()
      : "");
  if (payloadChanged || data.kieTaskId) {
    await prisma.canvasGenerationTask.update({
      where: { id: args.taskId },
      data,
    });
  }

  return {
    payload: nextPayload,
    gatewayLogId,
    kieTaskId: kieTaskId || args.kieTaskId?.trim() || "",
  };
}

export async function promoteCanvasTaskFromGatewayLog(args: {
  taskId: string;
  payload: Record<string, unknown>;
  logId: string;
  externalTaskId: string;
  scopeKey: string;
}): Promise<boolean> {
  return reviveCanvasTaskFromGatewayLog({
    taskId: args.taskId,
    payload: args.payload,
    logId: args.logId,
    externalTaskId: args.externalTaskId,
    scopeKey: args.scopeKey,
  });
}
