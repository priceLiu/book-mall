import type { GatewayRequestLog } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/log-progress";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import {
  attachGatewayTimingToSummary,
  computeVolcengineTimingBreakdown,
  isVolcenginePollLagCritical,
  isVolcengineQueuedStale,
  mergeVolcengineTimingTrace,
  readVolcengineTimingTrace,
  type VolcengineTimingBreakdown,
} from "@/lib/gateway/log-volcengine-timing";

/** 火山视频轮询：写入状态轨迹 + 实时耗时拆分（不覆盖终态 resultSummary）。 */
export async function persistVolcengineTimingOnPoll(input: {
  log: Pick<
    GatewayRequestLog,
    | "id"
    | "submittedAt"
    | "completedAt"
    | "resultSummary"
    | "status"
    | "lastPolledAt"
  >;
  vendorStatus: string;
  vendorRaw: unknown;
  /** 成功/失败 finalize 前可传入，用于写入最终 resultSummary */
  resultSummaryOverride?: unknown;
}): Promise<{
  breakdown: VolcengineTimingBreakdown;
  resultSummary: Record<string, unknown>;
  vendorStalled?: boolean;
}> {
  const polledAtMs = Date.now();
  const trace = mergeVolcengineTimingTrace(
    readVolcengineTimingTrace(input.log.resultSummary),
    {
      status: input.vendorStatus,
      raw: input.vendorRaw,
      polledAtMs,
    },
  );
  const breakdown = computeVolcengineTimingBreakdown({
    trace,
    submittedAtMs: input.log.submittedAt.getTime(),
    completedAtMs: input.log.completedAt?.getTime() ?? null,
    nowMs: polledAtMs,
  });

  const nextSummary = attachGatewayTimingToSummary(
    input.resultSummaryOverride ?? input.log.resultSummary,
    trace,
    breakdown,
    input.resultSummaryOverride,
  );

  const queuedStalled =
    !isGatewayLogTerminalStatus(input.log.status) &&
    isVolcengineQueuedStale(trace, polledAtMs);

  if (queuedStalled) {
    const durationMs = input.log.submittedAt
      ? polledAtMs - input.log.submittedAt.getTime()
      : 0;
    await finalizeRequestLog(input.log.id, {
      status: "FAILED",
      durationMs,
      failCode: "VOLCENGINE_QUEUED_STALE",
      failMessage:
        "Volcengine 任务在 queued 阶段 updated_at 已停更超过 10 分钟，判定厂商排队卡死；请在控制台核对或重试",
      resultSummary: nextSummary,
    });
    return { breakdown, resultSummary: nextSummary, vendorStalled: true };
  }

  const pollLagCritical =
    !isGatewayLogTerminalStatus(input.log.status) &&
    isVolcenginePollLagCritical(trace, polledAtMs);

  if (pollLagCritical) {
    const durationMs = input.log.submittedAt
      ? polledAtMs - input.log.submittedAt.getTime()
      : 0;
    await finalizeRequestLog(input.log.id, {
      status: "FAILED",
      durationMs,
      failCode: "VOLCENGINE_POLL_LAG",
      failMessage:
        "Volcengine 已返回终态但 Gateway 日志仍未 completed；请检查 poll worker 或刷新日志",
      resultSummary: nextSummary,
    });
    return { breakdown, resultSummary: nextSummary, vendorStalled: true };
  }

  if (!isGatewayLogTerminalStatus(input.log.status)) {
    await prisma.gatewayRequestLog.updateMany({
      where: {
        id: input.log.id,
        status: { notIn: ["SUCCEEDED", "FAILED", "CANCELLED"] },
      },
      data: {
        resultSummary: nextSummary as Prisma.InputJsonValue,
        lastPolledAt: new Date(polledAtMs),
        pollCount: { increment: 1 },
      },
    });
  }

  return { breakdown, resultSummary: nextSummary };
}

/** DB 可用时：收口「厂商 updated_at 停更 + Gateway 轮询中断」的 RUNNING 日志 */
export async function expireVolcengineGatewayPollStalledLogs(
  nowMs: number = Date.now(),
): Promise<number> {
  const {
    isVolcengineGatewayPollStalled,
    readVolcengineTimingTrace,
    computeVolcengineTimingBreakdown,
    attachGatewayTimingToSummary,
  } = await import("@/lib/gateway/log-volcengine-timing");
  const pollGapCutoff = new Date(nowMs - 2 * 60 * 1000);

  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      OR: [
        { lastPolledAt: { lt: pollGapCutoff } },
        { lastPolledAt: null, submittedAt: { lt: pollGapCutoff } },
      ],
    },
    select: {
      id: true,
      submittedAt: true,
      resultSummary: true,
      lastPolledAt: true,
    },
    take: 50,
  });

  let closed = 0;
  for (const row of rows) {
    const trace = readVolcengineTimingTrace(row.resultSummary);
    if (!trace) continue;
    if (
      !isVolcengineGatewayPollStalled(trace, row.lastPolledAt, nowMs)
    ) {
      continue;
    }
    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs: row.submittedAt.getTime(),
      completedAtMs: null,
      nowMs,
    });
    const resultSummary = attachGatewayTimingToSummary(
      row.resultSummary,
      trace,
      breakdown,
    );
    const durationMs = nowMs - row.submittedAt.getTime();
    await finalizeRequestLog(row.id, {
      status: "FAILED",
      durationMs,
      failCode: "VOLCENGINE_GATEWAY_POLL_STALL",
      failMessage:
        "厂商 updated_at 已停更超过 800s 且 Gateway 轮询中断（常见原因：数据库连接池耗尽）。请在厂商控制台核对任务；恢复 DB 后可用轮询池「恢复」",
      resultSummary,
    });
    closed++;
  }
  return closed;
}
