/**
 * Gateway KIE 提交互斥：同一 canvas task 仅允许一次 createTask（防 run API 与 poll worker 双提交）。
 */

import { createHash } from "node:crypto";
import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CANVAS_DB_TX_OPTIONS, runTxWithRetry } from "@/lib/db-tx-retry";
import { CanvasProjectError } from "./canvas-project-service";
import { findPromotableCanvasGatewayLog } from "@/lib/generation/traffic-control/canvas-orphan-gateway-log";
import { GENERATION_INFLIGHT_STATUSES } from "@/lib/generation/traffic-control/constants";

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> {
  const p = task.inputPayload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as Record<string, unknown>;
}

function taskAdvisoryLockKeys(taskId: string): [number, number] {
  const buf = createHash("sha256").update(`canvas-kie-submit:${taskId}`).digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

/** 项目内同 inputHash 的进行中任务（跨 nodeId，防双入口各建一条 task） */
export async function findProjectInflightTaskByInputHash(
  projectId: string,
  inputHash: string,
): Promise<CanvasGenerationTask | null> {
  return prisma.canvasGenerationTask.findFirst({
    where: {
      projectId,
      inputHash,
      status: { in: ["PENDING", "SUBMITTED", "QUEUED", "DISPATCHING"] },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assertNoProjectInflightByInputHash(
  projectId: string,
  inputHash: string,
): Promise<void> {
  const existing = await findProjectInflightTaskByInputHash(projectId, inputHash);
  if (existing) {
    throw new CanvasProjectError(
      "TASK_ALREADY_INFLIGHT",
      `project already has inflight task ${existing.id} for same input`,
      409,
    );
  }
}

/** 同节点同 inputHash 的兄弟任务是否已有厂商在跑（防 supersede 后重复 createTask）。 */
export async function findSiblingActiveVendorJob(args: {
  projectId: string;
  nodeId: string;
  inputHash: string;
  excludeTaskId: string;
}): Promise<{
  canvasTaskId: string;
  gatewayLogId: string;
  externalTaskId: string;
} | null> {
  const sibling = await prisma.canvasGenerationTask.findFirst({
    where: {
      projectId: args.projectId,
      nodeId: args.nodeId,
      inputHash: args.inputHash,
      id: { not: args.excludeTaskId },
      status: { in: [...GENERATION_INFLIGHT_STATUSES, "SUBMITTED"] },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, kieTaskId: true, inputPayload: true },
  });
  if (!sibling) return null;

  const payload = taskInputPayload(sibling);
  let gatewayLogId =
    typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";
  let externalTaskId = sibling.kieTaskId?.trim() ?? "";

  if (!gatewayLogId || !externalTaskId) {
    const orphan = await findPromotableCanvasGatewayLog(sibling.id);
    if (orphan) {
      gatewayLogId = orphan.logId;
      externalTaskId = orphan.externalTaskId;
    }
  }

  if (!gatewayLogId) {
    const log = await prisma.gatewayRequestLog.findFirst({
      where: {
        storyTaskId: sibling.id,
        status: { in: ["RUNNING", "PENDING", "SUCCEEDED"] },
        externalTaskId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, externalTaskId: true },
    });
    if (log?.id && log.externalTaskId?.trim()) {
      gatewayLogId = log.id;
      externalTaskId = log.externalTaskId.trim();
    }
  }

  if (!gatewayLogId || !externalTaskId) return null;

  const gw = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: { status: true },
  });
  if (!gw || gw.status === "FAILED") return null;

  return {
    canvasTaskId: sibling.id,
    gatewayLogId,
    externalTaskId,
  };
}

/**
 * 在调 canvasGwCreateKieJob 前占位；返回 claimed=false 表示已有 kieTaskId 或他方已 claim。
 */
export async function claimCanvasTaskKieSubmit(
  taskId: string,
): Promise<{ claimed: boolean; task: CanvasGenerationTask }> {
  // 同 taskId 由 pg_advisory_xact_lock 串行化即足够互斥；去掉 Serializable，
  // 改默认隔离级 + 瞬时错误重试，避免高并发 dispatch 时 P2034 → VIDEO_DISPATCH_FAILED。
  return runTxWithRetry(
    () =>
      prisma.$transaction(async (tx) => {
      const [k1, k2] = taskAdvisoryLockKeys(taskId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${k1}::int, ${k2}::int)`;

      const task = await tx.canvasGenerationTask.findUnique({
        where: { id: taskId },
      });
      if (!task) {
        throw new CanvasProjectError("NOT_FOUND", `task ${taskId} not found`, 404);
      }
      if (task.kieTaskId) {
        return { claimed: false, task };
      }

      const payload = taskInputPayload(task);
      if (payload.gatewayKieSubmitClaimed === true) {
        return { claimed: false, task };
      }

      const nextPayload = {
        ...payload,
        gatewayKieSubmitClaimed: true,
        syncGatewaySubmit: true,
      } as Prisma.InputJsonValue;

      const updated = await tx.canvasGenerationTask.update({
        where: { id: taskId },
        data: { inputPayload: nextPayload },
      });
      return { claimed: true, task: updated };
      }, CANVAS_DB_TX_OPTIONS),
    { label: "claimCanvasTaskKieSubmit", maxRetries: 5 },
  );
}
