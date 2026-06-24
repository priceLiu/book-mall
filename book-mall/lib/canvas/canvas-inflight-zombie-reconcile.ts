/**
 * 清理占用 poll / 交通槽但无法推进的 canvas 在飞任务（生成记录长期「生成中」）。
 */
import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getDispatchingStaleSec } from "@/lib/generation/traffic-control/constants";
import {
  releaseTrafficSlot,
} from "@/lib/generation/traffic-control/slot";
import { resolveCanvasProjectTrafficScope } from "@/lib/generation/traffic-control/scope-key";
import { queueDispatchAfterFromIndex } from "@/lib/generation/traffic-control/queue-dispatch-after";
import { isCanvasVideoTrafficKind } from "@/lib/generation/traffic-control/admit-canvas";
import { recoverCanvasVideoTaskDisplay } from "@/lib/canvas/canvas-video-display-recover";

const SUBMITTED_INCOMPLETE_MS = 3 * 60 * 1000;
const DISPATCHING_ZOMBIE_MS = () => getDispatchingStaleSec() * 1000;

function taskPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> {
  const p = task.inputPayload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as Record<string, unknown>;
}

export type CanvasInflightZombieReconcileSummary = {
  failedIncomplete: number;
  requeuedDispatching: number;
  displayRecovered: number;
};

/** poll 每轮开头：释放无法 poll 的 SUBMITTED/DISPATCHING 僵尸，并尝试 Gateway 已成功但未写回的任务。 */
export async function reconcileCanvasInflightZombies(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<CanvasInflightZombieReconcileSummary> {
  const limit = opts?.limit ?? 25;
  const projectFilter = opts?.projectId ? { projectId: opts.projectId } : {};
  const now = Date.now();
  const summary: CanvasInflightZombieReconcileSummary = {
    failedIncomplete: 0,
    requeuedDispatching: 0,
    displayRecovered: 0,
  };

  const incompleteCutoff = new Date(now - SUBMITTED_INCOMPLETE_MS);
  const incomplete = await prisma.canvasGenerationTask.findMany({
    where: {
      status: "SUBMITTED",
      kieTaskId: null,
      updatedAt: { lt: incompleteCutoff },
      ...projectFilter,
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      projectId: true,
      nodeId: true,
      inputPayload: true,
    },
  });

  for (const t of incomplete) {
    const payload = taskPayload(t);
    const gwId =
      typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";
    if (gwId) {
      const r = await recoverCanvasVideoTaskDisplay(t.id);
      if (r.ok && r.action !== "failed" && r.action !== "noop") {
        summary.displayRecovered += 1;
        continue;
      }
    }
    await prisma.canvasGenerationTask.update({
      where: { id: t.id },
      data: {
        status: "FAILED",
        failCode: "CANVAS_SUBMIT_INCOMPLETE",
        failMessage:
          "任务已提交但未获得厂商任务 ID，无法继续轮询；请重试生成",
        completedAt: new Date(),
        lastPolledAt: new Date(),
      },
    });
    summary.failedIncomplete += 1;
  }

  const dispatchCutoff = new Date(now - DISPATCHING_ZOMBIE_MS());
  const dispatchingZombies = await prisma.canvasGenerationTask.findMany({
    where: {
      status: "DISPATCHING",
      kieTaskId: null,
      updatedAt: { lt: dispatchCutoff },
      ...projectFilter,
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      projectId: true,
      actorUserId: true,
      inputPayload: true,
      project: { select: { userId: true } },
    },
  });

  let requeueIndex = 0;
  for (const t of dispatchingZombies) {
    const payload = taskPayload(t);
    if (payload.gatewayLogId || payload.gatewayKieSubmitClaimed === true) {
      continue;
    }
    const scope = await resolveCanvasProjectTrafficScope(
      t.projectId,
      t.actorUserId ?? t.project.userId,
    );
    await releaseTrafficSlot(scope.scopeKey);
    const videoKind = isCanvasVideoTrafficKind(payload);
    if (!videoKind) {
      await prisma.canvasGenerationTask.update({
        where: { id: t.id },
        data: {
          status: "FAILED",
          failCode: "DISPATCH_STUCK",
          failMessage: "出队超时未完成提交，请重试",
          completedAt: new Date(),
        },
      });
      summary.failedIncomplete += 1;
      continue;
    }
    await prisma.canvasGenerationTask.update({
      where: { id: t.id },
      data: {
        status: "QUEUED",
        dispatchAfter: queueDispatchAfterFromIndex(requeueIndex++),
        failCode: null,
        failMessage: null,
        inputPayload: {
          ...payload,
          gatewayKieSubmitClaimed: false,
          syncGatewaySubmit: true,
        } as Prisma.InputJsonValue,
      },
    });
    summary.requeuedDispatching += 1;
  }

  const submittedStuck = await prisma.canvasGenerationTask.findMany({
    where: {
      status: "SUBMITTED",
      kieTaskId: { not: null },
      ...projectFilter,
    },
    orderBy: [{ submittedAt: "asc" }, { updatedAt: "asc" }],
    take: limit,
    select: { id: true, inputPayload: true },
  });

  const gwIds = [
    ...new Set(
      submittedStuck
        .map((t) => {
          const p = taskPayload(t);
          return typeof p.gatewayLogId === "string" ? p.gatewayLogId.trim() : "";
        })
        .filter(Boolean),
    ),
  ];
  if (gwIds.length > 0) {
    const logs = await prisma.gatewayRequestLog.findMany({
      where: { id: { in: gwIds } },
      select: { id: true, status: true },
    });
    const terminal = new Set(
      logs
        .filter((l) => l.status === "SUCCEEDED" || l.status === "FAILED")
        .map((l) => l.id),
    );
    for (const t of submittedStuck) {
      if (summary.displayRecovered >= limit) break;
      const p = taskPayload(t);
      const gwId =
        typeof p.gatewayLogId === "string" ? p.gatewayLogId.trim() : "";
      if (!gwId || !terminal.has(gwId)) continue;
      const r = await recoverCanvasVideoTaskDisplay(t.id);
      if (r.ok && r.action !== "failed" && r.action !== "noop") {
        summary.displayRecovered += 1;
      }
    }
  }

  return summary;
}
