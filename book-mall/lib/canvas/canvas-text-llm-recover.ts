/**
 * 画布 TEXT LLM · Gateway Chat 已成功但 canvas 任务仍 SUBMITTED 时的写回。
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export function extractChatTextFromGatewaySummary(
  summary: unknown,
): string | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  if (typeof s.text === "string" && s.text.trim()) {
    return s.text.trim();
  }
  if (s.kind === "chat" && typeof s.text === "string" && s.text.trim()) {
    return s.text.trim();
  }
  return null;
}

export type CanvasTextLlmRecoverResult =
  | "succeeded"
  | "failed"
  | "pending"
  | "noop";

/** 按 storyTaskId（canvas task id）从 Gateway CHAT 日志恢复文本结果。 */
export async function recoverCanvasTextLlmFromGateway(
  taskId: string,
): Promise<CanvasTextLlmRecoverResult> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      kind: true,
      inputPayload: true,
    },
  });
  if (!task || task.kind !== "TEXT") return "noop";
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
        },
      });

  if (!log) return "noop";

  if (log.status === "SUCCEEDED") {
    const text = extractChatTextFromGatewaySummary(log.resultSummary);
    if (!text) return "pending";
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "SUCCEEDED",
        textOutput: text,
        completedAt: new Date(),
        inputPayload: {
          ...payload,
          gatewayLogId: log.id,
        } as Prisma.InputJsonValue,
      },
    });
    return "succeeded";
  }

  if (log.status === "FAILED") {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: log.failCode ?? "STORY_LLM_FAILED",
        failMessage:
          log.failMessage?.slice(0, 500) ?? "Gateway 文本模型调用失败",
        completedAt: new Date(),
        inputPayload: {
          ...payload,
          gatewayLogId: log.id,
        } as Prisma.InputJsonValue,
      },
    });
    return "failed";
  }

  return "pending";
}
