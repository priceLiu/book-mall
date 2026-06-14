import { prisma } from "@/lib/prisma";

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

export async function touchGatewayLogProgress(
  logId: string,
  resultSummary: Record<string, unknown>,
): Promise<void> {
  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: {
      resultSummary,
      lastPolledAt: new Date(),
      pollCount: { increment: 1 },
    },
  });
}
