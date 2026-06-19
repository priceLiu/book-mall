import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const GATEWAY_LOG_TERMINAL_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type GatewayLogTerminalStatus =
  (typeof GATEWAY_LOG_TERMINAL_STATUSES)[number];

/** Gateway 日志是否已进入终态（终态后禁止再写 task_progress）。 */
export function isGatewayLogTerminalStatus(
  status: string | null | undefined,
): status is GatewayLogTerminalStatus {
  return (
    status === "SUCCEEDED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

/** 异步任务轮询中的进度快照（写入 GatewayRequestLog.resultSummary） */
export function buildGatewayLogProgressSummary(opts: {
  providerKind: string;
  status: string;
  detail?: string;
}): Record<string, unknown> {
  return {
    kind: "task_progress",
    providerKind: opts.providerKind,
    status: opts.status,
    ...(opts.detail ? { detail: opts.detail } : {}),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 轮询进行中：更新 Gateway 日志进度快照。
 * 终态日志（SUCCEEDED/FAILED/CANCELLED）不再写入，避免覆盖成功结果。
 */
export async function touchGatewayLogProgress(
  logId: string,
  resultSummary: Record<string, unknown>,
): Promise<boolean> {
  const updated = await prisma.gatewayRequestLog.updateMany({
    where: {
      id: logId,
      status: { notIn: [...GATEWAY_LOG_TERMINAL_STATUSES] },
    },
    data: {
      resultSummary: resultSummary as Prisma.InputJsonValue,
      lastPolledAt: new Date(),
      pollCount: { increment: 1 },
    },
  });
  return updated.count > 0;
}
