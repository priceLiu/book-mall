/**
 * 画布 IMAGE · Gateway KIE 已成功但 canvas 任务仍 SUBMITTED 时的写回。
 */
import { applyCanvasKieTaskResult } from "@/lib/canvas/canvas-task-service";
import { prisma } from "@/lib/prisma";
import {
  isKieRecordFail,
  isKieRecordSuccess,
  type KieRecordResponse,
} from "@/lib/story/kie-client";

export function kieRecordFromGatewaySummary(
  summary: unknown,
  taskId: string,
  model: string,
): KieRecordResponse | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const state = typeof s.state === "string" ? s.state : undefined;
  const resultJson =
    typeof s.resultJson === "string" ? s.resultJson : undefined;
  if (!state && !resultJson) return null;
  return {
    taskId,
    model,
    state: (state as KieRecordResponse["state"]) ?? "success",
    resultJson,
    failCode: typeof s.failCode === "string" ? s.failCode : undefined,
    failMsg: typeof s.failMsg === "string" ? s.failMsg : undefined,
  };
}

export type CanvasKieImageRecoverResult =
  | "succeeded"
  | "failed"
  | "pending"
  | "noop";

/** 按 gatewayLogId / storyTaskId 从 Gateway KIE 日志恢复出图结果。 */
export async function recoverCanvasKieImageFromGateway(
  taskId: string,
): Promise<CanvasKieImageRecoverResult> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      kind: true,
      model: true,
      kieTaskId: true,
      inputPayload: true,
    },
  });
  if (!task || task.kind !== "IMAGE") return "noop";
  if (task.status !== "SUBMITTED" && task.status !== "PENDING") return "noop";

  const payload =
    task.inputPayload && typeof task.inputPayload === "object"
      ? (task.inputPayload as Record<string, unknown>)
      : {};
  const payloadLogId =
    typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";

  const log = payloadLogId
    ? await prisma.gatewayRequestLog.findUnique({
        where: { id: payloadLogId },
        select: {
          id: true,
          status: true,
          failCode: true,
          failMessage: true,
          resultSummary: true,
          providerKind: true,
        },
      })
    : await prisma.gatewayRequestLog.findFirst({
        where: { storyTaskId: taskId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          failCode: true,
          failMessage: true,
          resultSummary: true,
          providerKind: true,
        },
      });

  if (!log) return "noop";
  if (log.providerKind && log.providerKind !== "KIE") return "noop";

  if (log.status === "SUCCEEDED") {
    const record = kieRecordFromGatewaySummary(
      log.resultSummary,
      task.kieTaskId ?? "",
      task.model,
    );
    if (!record || !isKieRecordSuccess(record.state)) return "pending";
    await applyCanvasKieTaskResult(task.id, record);
    const after = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
    if (after?.status === "SUCCEEDED") return "succeeded";
    if (after?.status === "FAILED") return "failed";
    return "pending";
  }

  if (log.status === "FAILED") {
    const record = kieRecordFromGatewaySummary(
      log.resultSummary,
      task.kieTaskId ?? "",
      task.model,
    );
    if (record && isKieRecordFail(record.state)) {
      await applyCanvasKieTaskResult(task.id, {
        ...record,
        state: "fail",
        failMsg: log.failMessage ?? record.failMsg,
        failCode: log.failCode ?? record.failCode,
      });
      return "failed";
    }
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: log.failCode ?? "KIE_GATEWAY_FAILED",
        failMessage:
          log.failMessage?.slice(0, 500) ?? "Gateway KIE 任务失败",
        completedAt: new Date(),
      },
    });
    return "failed";
  }

  return "pending";
}
