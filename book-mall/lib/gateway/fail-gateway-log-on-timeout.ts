import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { releaseTrafficSlotFromGatewayLog } from "@/lib/generation/traffic-control/slot";
import { prisma } from "@/lib/prisma";

/**
 * 画布 / 漫剧 poll worker 超时收口：Gateway 日志仍为 RUNNING 时标记失败并解冻视频冻结额。
 * 避免「Canvas 任务已 FAILED、Gateway 仍 running、积分 RESERVE 未 RELEASE」三态分裂。
 */
export async function failGatewayLogIfStillRunning(input: {
  gatewayLogId: string;
  durationMs: number;
  timeoutMin: number;
  externalTaskId?: string | null;
}): Promise<void> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: input.gatewayLogId },
    select: { id: true, status: true, externalTaskId: true },
  });
  if (!log || log.status !== "RUNNING") return;

  await finalizeRequestLog(log.id, {
    status: "FAILED",
    durationMs: Math.max(0, input.durationMs),
    failCode: "CANVAS_TASK_TIMEOUT",
    failMessage: `任务等待超过 ${input.timeoutMin} 分钟，画布已停止轮询；若厂商仍在处理请到 Gateway 日志核对 taskId`,
    externalTaskId:
      input.externalTaskId?.trim() ||
      log.externalTaskId?.trim() ||
      undefined,
  }).catch((e) => {
    console.warn("[failGatewayLogIfStillRunning]", log.id, e);
  });

  const fullLog = await prisma.gatewayRequestLog.findUnique({
    where: { id: log.id },
    select: {
      tenantId: true,
      actorBookUserId: true,
      userId: true,
      requestKind: true,
    },
  });
  if (fullLog) {
    await releaseTrafficSlotFromGatewayLog(fullLog);
  }
}
