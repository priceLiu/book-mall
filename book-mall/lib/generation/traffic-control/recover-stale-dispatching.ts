/**
 * 提交厂商前 · 自动释放 + 重排（pre-submit self-heal）
 *
 * 两层「释放」：
 * 1. 交通槽：DISPATCHING 卡住 → releaseTrafficSlot，把 pipeline 槽位还给队列
 * 2. 提交 claim：gatewayKieSubmitClaimed 卡住 → 清 claim，允许再次 createTask
 *
 * 重排：状态退回 QUEUED + dispatchAfter 立即可派 + fireDispatch
 * 节奏：每轮至少间隔 DISPATCHING_STALE_SEC（默认 30s）；累计 DISPATCH_STALE_RETRY_MAX（6）次仍失败 → 终态失败
 */

import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { canvasVideoPayloadWhere } from "@/lib/canvas/canvas-queue-without-log";
import { prisma } from "@/lib/prisma";

import { getDispatchingStaleSec } from "./constants";
import { queueDispatchAfterFromIndex } from "./queue-dispatch-after";
import {
  clearDispatchStaleRetryInPayload,
  failCanvasTaskPreSubmitTimeout,
  isPreSubmitRetryExhausted,
  nextDispatchStaleRetryPayload,
} from "./pre-submit-retry";
import { releaseTrafficSlot } from "./slot";
import { resolveCanvasProjectTrafficScope } from "./scope-key";
import { releaseGatewayVideoTrafficSlotIfOccupying } from "./release-gateway-video-traffic-slot";

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> {
  const p = task.inputPayload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as Record<string, unknown>;
}

function stalePreSubmitCutoff(): Date {
  return new Date(Date.now() - getDispatchingStaleSec() * 1000);
}

function readDispatchingAtMs(payload: Record<string, unknown>): number | null {
  const raw = payload.dispatchingAt;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function isStalePreSubmitTask(
  task: Pick<CanvasGenerationTask, "updatedAt" | "queuedAt" | "createdAt" | "kieTaskId" | "inputPayload">,
  cutoff: Date,
): boolean {
  const cutoffMs = cutoff.getTime();
  if (task.updatedAt.getTime() <= cutoffMs) return true;
  if (task.kieTaskId) return false;
  const payload = taskInputPayload(task);
  const dispatchingMs = readDispatchingAtMs(payload);
  if (dispatchingMs != null && dispatchingMs <= cutoffMs) return true;
  const queuedMs = (task.queuedAt ?? task.createdAt).getTime();
  return queuedMs <= cutoffMs;
}

function staleDispatchingWhere(
  projectId: string | undefined,
  cutoff: Date,
): Prisma.CanvasGenerationTaskWhereInput {
  return {
    status: "DISPATCHING",
    ...(projectId ? { projectId } : {}),
    ...canvasVideoPayloadWhere(),
    OR: [
      { updatedAt: { lte: cutoff } },
      { kieTaskId: null, queuedAt: { lte: cutoff } },
      { kieTaskId: null, queuedAt: null, createdAt: { lte: cutoff } },
    ],
  };
}

function staleQueuedWhere(
  projectId: string | undefined,
  cutoff: Date,
): Prisma.CanvasGenerationTaskWhereInput {
  const now = new Date();
  return {
    status: "QUEUED",
    ...(projectId ? { projectId } : {}),
    ...canvasVideoPayloadWhere(),
    AND: [
      {
        OR: [
          { queuedAt: { lte: cutoff } },
          { queuedAt: null, createdAt: { lte: cutoff } },
        ],
      },
      {
        OR: [{ dispatchAfter: null }, { dispatchAfter: { lte: now } }],
      },
    ],
  };
}

/** Gateway log 已建但 canvas 仍 DISPATCHING：补写 SUBMITTED，避免合成行永久卡住。 */
async function promoteDispatchingWithGatewayLog(
  task: Pick<CanvasGenerationTask, "id" | "projectId" | "actorUserId" | "inputPayload"> & {
    project: { userId: string };
  },
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

  const updated = await prisma.canvasGenerationTask.updateMany({
    where: { id: task.id, status: "DISPATCHING" },
    data: {
      status: "SUBMITTED",
      kieTaskId: vendorTaskId,
      submittedAt: new Date(),
      lastPolledAt: new Date(),
      inputPayload: clearDispatchStaleRetryInPayload({
        ...payload,
        gatewayLogId,
        gatewayKieSubmitClaimed: true,
        syncGatewaySubmit: true,
        trafficScopeKey: scopeKey,
      }) as Prisma.InputJsonValue,
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

async function recoverStaleQueuedCanvasTasks(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<number> {
  const cutoff = stalePreSubmitCutoff();
  const stale = await prisma.canvasGenerationTask.findMany({
    where: staleQueuedWhere(opts?.projectId, cutoff),
    select: {
      id: true,
      inputPayload: true,
    },
    orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
    take: opts?.limit ?? 20,
  });

  let n = 0;
  for (const t of stale) {
    const payload = taskInputPayload(t);
    if (isPreSubmitRetryExhausted(payload)) {
      await failCanvasTaskPreSubmitTimeout(t.id, payload);
      n++;
      continue;
    }
    const { payload: nextPayload } = nextDispatchStaleRetryPayload(payload);
    await prisma.canvasGenerationTask.update({
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

async function recoverStaleDispatchingOnly(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<number> {
  const cutoff = stalePreSubmitCutoff();
  const stale = await prisma.canvasGenerationTask.findMany({
    where: staleDispatchingWhere(opts?.projectId, cutoff),
    select: {
      id: true,
      projectId: true,
      actorUserId: true,
      inputPayload: true,
      kieTaskId: true,
      updatedAt: true,
      queuedAt: true,
      createdAt: true,
      project: { select: { userId: true } },
    },
    orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
    take: opts?.limit ?? 20,
  });

  let n = 0;
  for (const t of stale) {
    if (!isStalePreSubmitTask(t, cutoff)) continue;
    const payload = taskInputPayload(t);
    const gwId =
      typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";

    const scope = await resolveCanvasProjectTrafficScope(
      t.projectId,
      t.actorUserId ?? t.project.userId,
    );

    if (gwId) {
      const promoted = await promoteDispatchingWithGatewayLog(
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
      await failCanvasTaskPreSubmitTimeout(t.id, payload);
      n++;
      continue;
    }

    await releaseTrafficSlot(scope.scopeKey);
    const stuckClaim =
      payload.gatewayKieSubmitClaimed === true && !payload.gatewayLogId && !t.kieTaskId;
    const { payload: nextPayload } = nextDispatchStaleRetryPayload(payload);
    await prisma.canvasGenerationTask.update({
      where: { id: t.id, status: "DISPATCHING" },
      data: {
        status: "QUEUED",
        dispatchAfter: queueDispatchAfterFromIndex(n),
        failCode: null,
        failMessage: null,
        inputPayload: {
          ...nextPayload,
          ...(stuckClaim
            ? {
                gatewayKieSubmitClaimed: false,
                syncGatewaySubmit: true,
              }
            : {}),
        } as Prisma.InputJsonValue,
      },
    });
    n++;
  }
  return n;
}

/**
 * 提交厂商前超时自愈：30s × 最多 6 次自动重派；耗尽 →「提交生成超时, 请重试」。
 */
export async function recoverStaleDispatchingCanvasTasks(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<number> {
  const limit = opts?.limit ?? 20;
  const dispatching = await recoverStaleDispatchingOnly({ ...opts, limit });
  const queued = await recoverStaleQueuedCanvasTasks({ ...opts, limit });
  return dispatching + queued;
}

/** Canvas 视频 + 漫剧 FRAME_VIDEO · pre-submit 自动释放 + 重排 */
export async function recoverStalePreSubmitVideoTasks(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<number> {
  const canvas = await recoverStaleDispatchingCanvasTasks(opts);
  const { recoverStaleDispatchingStoryTasks } = await import(
    "./recover-stale-dispatching-story"
  );
  const story = await recoverStaleDispatchingStoryTasks(opts);
  return canvas + story;
}

const lastScheduledRecoverAt = new Map<string, number>();
const SCHEDULE_RECOVER_MIN_GAP_MS = 5_000;

/** fire-and-forget：DISPATCHING / QUEUED 超时自愈 + 重派 */
export function scheduleRecoverStaleDispatching(
  projectId: string | undefined,
  source: string,
): void {
  const key = projectId ?? "__global__";
  const now = Date.now();
  if (now - (lastScheduledRecoverAt.get(key) ?? 0) < SCHEDULE_RECOVER_MIN_GAP_MS) {
    return;
  }
  lastScheduledRecoverAt.set(key, now);
  void recoverStalePreSubmitVideoTasks({ projectId, limit: 25 })
    .then(async (n) => {
      if (n <= 0) return;
      const { fireCanvasDispatchForProject, fireVideoTrafficDispatchBacklog } =
        await import("./fire-canvas-dispatch");
      if (projectId) {
        fireCanvasDispatchForProject(projectId, `${source}-after-recover`, {
          bypassDebounce: true,
        });
      } else {
        fireVideoTrafficDispatchBacklog(`${source}-after-recover`, {
          bypassDebounce: true,
        });
      }
      if (
        process.env.NODE_ENV === "development" ||
        process.env.CANVAS_DISPATCH_LOG === "1"
      ) {
        console.info(`[dispatch-recover] ${source} recovered=${n}`, { projectId });
      }
    })
    .catch((e) => {
      console.warn(
        `[dispatch-recover] ${source} failed`,
        e instanceof Error ? e.message : String(e),
      );
    });
}
