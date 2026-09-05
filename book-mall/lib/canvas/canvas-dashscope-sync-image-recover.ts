/**
 * Canvas · DashScope 同步 multimodal 出图（qwen-image-edit* / qwen-image-3.0-pro / z-image-turbo）
 * Gateway 已成功但 canvas 任务 kieTaskId 为空或仍 SUBMITTED/FAILED 时的写回。
 */
import type { Prisma } from "@prisma/client";

import {
  applyCanvasDashscopeImagePollResult,
} from "@/lib/canvas/canvas-task-service";
import { patchCanvasProjectNodeMediaFromTask } from "@/lib/canvas/canvas-media-patch";
import {
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import { prisma } from "@/lib/prisma";

function readDashscopeImageOutput(
  resultSummary: unknown,
): DashscopeTaskOutput | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  const summary = resultSummary as Record<string, unknown>;
  const output = summary.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const typed = output as DashscopeTaskOutput;
  if (summary.sync === true) return typed;
  if (isDashscopeTaskSuccess(String(typed.task_status ?? ""))) return typed;
  return null;
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

  const output = readDashscopeImageOutput(log.resultSummary);
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

/** SUCCEEDED 任务 · 将 managed OSS / runtime 终态写回 story-pro2-image 等节点。 */
export async function recoverCanvasDashscopeImageDisplayFromTask(
  taskId: string,
): Promise<"succeeded" | "failed" | "noop"> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      projectId: true,
      nodeId: true,
      ossUrl: true,
      ephemeralUrl: true,
      completedAt: true,
      resultPayload: true,
    },
  });
  if (!task || task.status !== "SUCCEEDED") return "noop";
  if (!(task.ossUrl?.trim() || task.ephemeralUrl?.trim())) return "noop";
  const patched = await patchCanvasProjectNodeMediaFromTask(task);
  return patched ? "succeeded" : "noop";
}
