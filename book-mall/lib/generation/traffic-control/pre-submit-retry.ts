import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { getDispatchStaleRetryMax } from "./constants";

export const SUBMIT_DISPATCH_TIMEOUT_FAIL_CODE = "SUBMIT_DISPATCH_TIMEOUT";
export const SUBMIT_DISPATCH_TIMEOUT_MESSAGE = "提交生成超时, 请重试";

export function readDispatchStaleRetryCount(
  payload: Record<string, unknown>,
): number {
  const n = Number(payload.dispatchStaleRetryCount);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function nextDispatchStaleRetryPayload(
  payload: Record<string, unknown>,
): { count: number; payload: Record<string, unknown> } {
  const count = readDispatchStaleRetryCount(payload) + 1;
  return {
    count,
    payload: { ...payload, dispatchStaleRetryCount: count },
  };
}

/** SUBMITTED 成功后清零，避免 payload 残留 retry 计数 */
export function clearDispatchStaleRetryInPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (!("dispatchStaleRetryCount" in payload)) return payload;
  const next = { ...payload };
  delete next.dispatchStaleRetryCount;
  return next;
}

export function isPreSubmitRetryExhausted(payload: Record<string, unknown>): boolean {
  return readDispatchStaleRetryCount(payload) >= getDispatchStaleRetryMax();
}

export async function failStoryTaskPreSubmitTimeout(
  taskId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.storyGenerationTask.update({
    where: { id: taskId },
    data: {
      status: "FAILED",
      failCode: SUBMIT_DISPATCH_TIMEOUT_FAIL_CODE,
      failMessage: SUBMIT_DISPATCH_TIMEOUT_MESSAGE,
      completedAt: new Date(),
      inputPayload: payload as Prisma.InputJsonValue,
    },
  });
}

export async function failCanvasTaskPreSubmitTimeout(
  taskId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.canvasGenerationTask.update({
    where: { id: taskId },
    data: {
      status: "FAILED",
      failCode: SUBMIT_DISPATCH_TIMEOUT_FAIL_CODE,
      failMessage: SUBMIT_DISPATCH_TIMEOUT_MESSAGE,
      completedAt: new Date(),
      inputPayload: payload as Prisma.InputJsonValue,
    },
  });
}
