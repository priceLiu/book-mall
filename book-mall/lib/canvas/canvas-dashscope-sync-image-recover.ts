/**
 * Canvas · DashScope 同步 multimodal 出图（qwen-image-edit* / qwen-image-3.0-pro / z-image-turbo）
 * Gateway 已成功但 canvas 任务 kieTaskId 为空或仍 SUBMITTED/FAILED 时的写回。
 */
import type { Prisma } from "@prisma/client";

import {
  applyCanvasDashscopeImagePollResult,
  type DashscopeTaskOutput,
} from "@/lib/canvas/canvas-task-service";
import { prisma } from "@/lib/prisma";

function readSyncOutput(
  resultSummary: unknown,
): DashscopeTaskOutput | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  const summary = resultSummary as Record<string, unknown>;
  if (summary.sync !== true) return null;
  const output = summary.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  return output as DashscopeTaskOutput;
}

/** 从 Gateway 日志回收同步 DashScope 出图并写回节点。 */
export async function recoverCanvasDashscopeSyncImageFromGateway(
  taskId: string,
): Promise<"succeeded" | "failed" | "noop"> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      kieTaskId: true,
      inputPayload: true,
    },
  });
  if (!task) return "noop";
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") return "noop";

  const payload =
    task.inputPayload &&
    typeof task.inputPayload === "object" &&
    !Array.isArray(task.inputPayload)
      ? (task.inputPayload as Record<string, unknown>)
      : {};
  const gatewayLogId =
    typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";
  if (!gatewayLogId) return "noop";

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: {
      id: true,
      status: true,
      externalTaskId: true,
      resultSummary: true,
    },
  });
  if (!log || log.status !== "SUCCEEDED") return "noop";

  const output = readSyncOutput(log.resultSummary);
  if (!output) return "noop";

  const externalTaskId = log.externalTaskId?.trim() || log.id;
  if (!task.kieTaskId?.trim() || task.status === "FAILED") {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "SUBMITTED",
        kieTaskId: externalTaskId,
        failCode: null,
        failMessage: null,
        completedAt: null,
        lastPolledAt: new Date(),
        inputPayload: {
          ...payload,
          gatewayLogId,
          providerKind: payload.providerKind ?? "DASHSCOPE",
          dashscopeJobKind:
            payload.dashscopeJobKind ?? "multimodal-image-sync",
        } as Prisma.InputJsonValue,
      },
    });
  }

  await applyCanvasDashscopeImagePollResult(taskId, output);

  const after = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });
  if (after?.status === "SUCCEEDED") return "succeeded";
  if (after?.status === "FAILED") return "failed";
  return "noop";
}
