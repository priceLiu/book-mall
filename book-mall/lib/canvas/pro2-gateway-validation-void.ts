/**
 * Pro2 结构化 LLM：厂商 HTTP 成功但下游 JSON 校验失败时，
 * 将 GatewayRequestLog 翻转为 FAILED 并退还平台积分（不计用户扣费）。
 */
import type { GatewayRequestLog } from "@prisma/client";

import { refundFailedGatewayLog } from "@/lib/billing/gateway-credit-settlement";
import { prisma } from "@/lib/prisma";
import { recordGatewayPlatformError } from "@/lib/platform-error-log";

export const PRO2_GATEWAY_VALIDATION_FAIL_CODE = "PRO2_SCRIPT_JSON_INVALID";

export type VoidPro2GatewayValidationOpts = {
  error: string;
  attempt: number;
  maxAttempts: number;
  canvasTaskId?: string;
};

function buildPro2ValidationFailMessage(opts: VoidPro2GatewayValidationOpts): string {
  return [
    `[Pro2 结构化校验失败 · 第 ${opts.attempt}/${opts.maxAttempts} 次]`,
    opts.error.trim().slice(0, 400) || "校验失败",
    "厂商已返回内容但未通过 pro2-production-script 校验；本次不计用户积分。",
  ].join(" ");
}

/** 将已成功落库的 Gateway 日志标记为校验失败并退积分。 */
export async function voidGatewayLogForPro2ValidationFailure(
  logId: string,
  opts: VoidPro2GatewayValidationOpts,
): Promise<void> {
  const id = logId?.trim();
  if (!id) return;

  const log = await prisma.gatewayRequestLog.findUnique({ where: { id } });
  if (!log) return;

  const failMessage = buildPro2ValidationFailMessage(opts);
  const prevSummary =
    log.resultSummary &&
    typeof log.resultSummary === "object" &&
    !Array.isArray(log.resultSummary)
      ? (log.resultSummary as Record<string, unknown>)
      : {};

  if (log.status === "SUCCEEDED") {
    await prisma.gatewayRequestLog.update({
      where: { id },
      data: {
        status: "FAILED",
        failCode: PRO2_GATEWAY_VALIDATION_FAIL_CODE,
        failMessage,
        resultSummary: {
          ...prevSummary,
          pro2ValidationVoid: {
            attempt: opts.attempt,
            maxAttempts: opts.maxAttempts,
            canvasTaskId: opts.canvasTaskId ?? null,
            error: opts.error.trim().slice(0, 300),
          },
        },
      },
    });
    const settled = await prisma.gatewayRequestLog.findUnique({ where: { id } });
    if (settled) {
      await refundFailedGatewayLog(settled);
    }
  } else if (log.status === "FAILED" || log.status === "RUNNING" || log.status === "PENDING") {
    await prisma.gatewayRequestLog.update({
      where: { id },
      data: {
        status: "FAILED",
        failCode: log.failCode?.trim() || PRO2_GATEWAY_VALIDATION_FAIL_CODE,
        failMessage,
        completedAt: log.completedAt ?? new Date(),
        resultSummary: {
          ...prevSummary,
          pro2ValidationVoid: {
            attempt: opts.attempt,
            maxAttempts: opts.maxAttempts,
            canvasTaskId: opts.canvasTaskId ?? null,
            error: opts.error.trim().slice(0, 300),
          },
        },
      },
    });
    const settled = await prisma.gatewayRequestLog.findUnique({ where: { id } });
    if (settled?.creditsCharged && settled.creditsCharged > 0) {
      await refundFailedGatewayLog(settled);
    }
  }

  recordGatewayPlatformError({
    logId: id,
    failCode: PRO2_GATEWAY_VALIDATION_FAIL_CODE,
    failMessage,
    model: log.model,
    endpoint: log.endpoint,
    clientPage: log.clientPage,
    storyTaskId: opts.canvasTaskId ?? log.storyTaskId,
    userId: log.userId,
  });
}
