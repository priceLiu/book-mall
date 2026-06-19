/**
 * Gateway KIE 提交互斥：同一 canvas task 仅允许一次 createTask（防 run API 与 poll worker 双提交）。
 */

import { createHash } from "node:crypto";
import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CanvasProjectError } from "./canvas-project-service";

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

/**
 * 在调 canvasGwCreateKieJob 前占位；返回 claimed=false 表示已有 kieTaskId 或他方已 claim。
 */
export async function claimCanvasTaskKieSubmit(
  taskId: string,
): Promise<{ claimed: boolean; task: CanvasGenerationTask }> {
  return prisma.$transaction(
    async (tx) => {
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
    },
    { isolationLevel: "Serializable" },
  );
}
