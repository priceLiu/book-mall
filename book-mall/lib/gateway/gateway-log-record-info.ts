import type { GatewayRequestLog } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** recordInfo 日志定位：优先 logId（精确），否则 taskId 最新一条（兼容旧客户端） */
export async function resolveGatewayLogForRecordInfo(input: {
  authUserId: string;
  taskId: string;
  logId?: string | null;
}): Promise<GatewayRequestLog | null> {
  const logId = input.logId?.trim();
  if (logId) {
    const byId = await prisma.gatewayRequestLog.findFirst({
      where: {
        id: logId,
        userId: input.authUserId,
      },
    });
    if (!byId) return null;
    if (byId.externalTaskId && byId.externalTaskId !== input.taskId) {
      return null;
    }
    return byId;
  }

  return prisma.gatewayRequestLog.findFirst({
    where: {
      userId: input.authUserId,
      externalTaskId: input.taskId,
    },
    orderBy: { submittedAt: "desc" },
  });
}

export function isGatewayLogTerminalStatus(
  status: string | null | undefined,
): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
}
