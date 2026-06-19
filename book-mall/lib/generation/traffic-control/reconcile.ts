import { prisma } from "@/lib/prisma";
import { refundFailedGatewayLog } from "@/lib/billing/gateway-credit-settlement";
import { failGatewayLogIfStillRunning } from "@/lib/gateway/fail-gateway-log-on-timeout";
import { getCanvasVolcengineVideoTimeoutMin } from "@/lib/canvas/canvas-constants";
import { CANVAS_AI_TASK_TIMEOUT_MIN } from "@/lib/canvas/canvas-constants";

import {
  getDispatchingStaleSec,
  getReconcileRunningVideoMaxMin,
} from "./constants";
import { releaseTrafficSlot, releaseTrafficSlotFromGatewayLog } from "./slot";
import { resolveTrafficScopeFromIds } from "./scope-key";
import { dispatchQueuedCanvasTasks } from "./dispatch-canvas";

export type ReconcileTrafficReport = {
  releasedReserve: number;
  failedRunningLogs: number;
  reconciledSlots: number;
  staleDispatching: number;
  queueTimeouts: number;
};

async function releaseStaleVideoReserves(): Promise<number> {
  const maxMin = getReconcileRunningVideoMaxMin();
  const cutoff = new Date(Date.now() - maxMin * 60_000);

  const reserves = await prisma.creditLedger.findMany({
    where: {
      type: "RESERVE",
      createdAt: { lt: cutoff },
      idempotencyKey: { startsWith: "reserve:" },
    },
    select: { idempotencyKey: true, refId: true },
    take: 100,
  });

  let n = 0;
  for (const row of reserves) {
    const logId = row.idempotencyKey?.replace(/^reserve:/, "") ?? "";
    if (!logId) continue;
    const settled = await prisma.creditLedger.findFirst({
      where: {
        OR: [
          { idempotencyKey: `settle:${logId}` },
          { idempotencyKey: `release:${logId}` },
        ],
      },
      select: { id: true },
    });
    if (settled) continue;

    const log = await prisma.gatewayRequestLog.findUnique({
      where: { id: logId },
      select: {
        id: true,
        status: true,
        requestKind: true,
        tenantId: true,
        actorBookUserId: true,
        userId: true,
        submittedAt: true,
      },
    });
    if (!log || log.requestKind !== "VIDEO") continue;
    if (log.status === "SUCCEEDED") continue;

    if (log.status === "RUNNING") {
      const ageMin = log.submittedAt
        ? (Date.now() - log.submittedAt.getTime()) / 60_000
        : maxMin + 1;
      const timeoutMin =
        ageMin > CANVAS_AI_TASK_TIMEOUT_MIN
          ? getCanvasVolcengineVideoTimeoutMin()
          : CANVAS_AI_TASK_TIMEOUT_MIN;
      await failGatewayLogIfStillRunning({
        gatewayLogId: log.id,
        durationMs: log.submittedAt
          ? Date.now() - log.submittedAt.getTime()
          : maxMin * 60_000,
        timeoutMin: Math.round(timeoutMin),
      });
    } else if (log.status === "FAILED") {
      await refundFailedGatewayLog(log as Parameters<typeof refundFailedGatewayLog>[0]);
    }

    await releaseTrafficSlotFromGatewayLog(log);
    n++;
  }
  return n;
}

async function reconcileRunningSlotCounts(): Promise<number> {
  const states = await prisma.generationTrafficState.findMany({ take: 200 });
  let fixed = 0;
  for (const state of states) {
    const where =
      state.ownerType === "TENANT"
        ? { tenantId: state.ownerId, requestKind: "VIDEO" as const, status: "RUNNING" as const }
        : {
            tenantId: null,
            requestKind: "VIDEO" as const,
            status: "RUNNING" as const,
            OR: [{ actorBookUserId: state.ownerId }, { userId: state.ownerId }],
          };
    const actual = await prisma.gatewayRequestLog.count({ where });
    if (actual !== state.runningVideoCount) {
      await prisma.generationTrafficState.update({
        where: { scopeKey: state.scopeKey },
        data: { runningVideoCount: actual },
      });
      fixed++;
    }
  }
  return fixed;
}

async function recoverStaleDispatchingTasks(): Promise<number> {
  const cutoff = new Date(Date.now() - getDispatchingStaleSec() * 1000);
  const stale = await prisma.canvasGenerationTask.findMany({
    where: { status: "DISPATCHING", updatedAt: { lt: cutoff } },
    select: { id: true, projectId: true, actorUserId: true, project: { select: { userId: true } } },
    take: 50,
  });
  let n = 0;
  for (const t of stale) {
    const { resolveCanvasProjectTrafficScope } = await import("./scope-key");
    const scope = await resolveCanvasProjectTrafficScope(
      t.projectId,
      t.actorUserId ?? t.project.userId,
    );
    await releaseTrafficSlot(scope.scopeKey);
    await prisma.canvasGenerationTask.update({
      where: { id: t.id },
      data: { status: "QUEUED", dispatchAfter: new Date() },
    });
    n++;
  }
  return n;
}

/** P0 对账 + 顺带推进 QUEUED dispatch（cron / 脚本） */
export async function reconcileGenerationTraffic(opts?: {
  projectId?: string;
  dispatch?: boolean;
}): Promise<ReconcileTrafficReport> {
  const report: ReconcileTrafficReport = {
    releasedReserve: 0,
    failedRunningLogs: 0,
    reconciledSlots: 0,
    staleDispatching: 0,
    queueTimeouts: 0,
  };

  report.releasedReserve = await releaseStaleVideoReserves();
  report.reconciledSlots = await reconcileRunningSlotCounts();
  report.staleDispatching = await recoverStaleDispatchingTasks();

  if (opts?.dispatch !== false) {
    const d = await dispatchQueuedCanvasTasks({ projectId: opts?.projectId });
    report.queueTimeouts = d.cancelled;
  }

  return report;
}

export { releaseTrafficSlotFromGatewayLog, resolveTrafficScopeFromIds };
