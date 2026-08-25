import type { GatewayRequestLog } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/log-progress";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import type { DashscopeTaskOutput } from "@/lib/gateway/dashscope-client";
import {
  attachDashscopeTimingToSummary,
  buildDashscopeTerminalFinalizeMetrics,
  bumpDashscopePeakPollDelay,
  computeDashscopeTimingBreakdown,
  mergeDashscopeTimingTrace,
  readDashscopeTimingTrace,
  type DashscopeTimingBreakdown,
} from "@/lib/gateway/log-dashscope-timing";

/** 百炼 / DashScope 异步轮询：写入状态轨迹 + 实时耗时拆分。 */
export async function persistDashscopeTimingOnPoll(input: {
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
  vendorOutput: DashscopeTaskOutput | Record<string, unknown>;
  resultSummaryOverride?: unknown;
}): Promise<{
  breakdown: DashscopeTimingBreakdown;
  resultSummary: Record<string, unknown>;
}> {
  const polledAtMs = Date.now();
  const trace = mergeDashscopeTimingTrace(
    readDashscopeTimingTrace(input.log.resultSummary),
    {
      status: input.vendorStatus,
      output: input.vendorOutput,
      polledAtMs,
    },
  );
  const breakdown = computeDashscopeTimingBreakdown({
    trace,
    submittedAtMs: input.log.submittedAt.getTime(),
    completedAtMs: input.log.completedAt?.getTime() ?? null,
    nowMs: polledAtMs,
  });
  const traceWithPeak = bumpDashscopePeakPollDelay(trace, breakdown.pollDelayMs);
  const breakdownFinal = computeDashscopeTimingBreakdown({
    trace: traceWithPeak,
    submittedAtMs: input.log.submittedAt.getTime(),
    completedAtMs: input.log.completedAt?.getTime() ?? null,
    nowMs: polledAtMs,
  });

  const nextSummary = attachDashscopeTimingToSummary(
    input.resultSummaryOverride ?? input.log.resultSummary,
    traceWithPeak,
    breakdownFinal,
    input.resultSummaryOverride,
  );

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

  return { breakdown: breakdownFinal, resultSummary: nextSummary };
}

type DashscopeFinalizePatch = Omit<
  Parameters<typeof finalizeRequestLog>[1],
  "status" | "durationMs" | "resultSummary" | "completedAt"
>;

/** 百炼 / DashScope 异步终态：按 trace 冻结 completedAt / durationMs / 阶段拆分。 */
export async function finalizeDashscopeAsyncRequestLog(
  logId: string,
  input: {
    submittedAt: Date;
    status: "SUCCEEDED" | "FAILED";
    trace: import("@/lib/gateway/log-dashscope-timing").DashscopeTimingTrace;
    resultSummaryBase: unknown;
    fallbackNowMs?: number;
  } & DashscopeFinalizePatch,
): Promise<void> {
  const { submittedAt, status, trace, resultSummaryBase, fallbackNowMs, ...patch } =
    input;
  const metrics = buildDashscopeTerminalFinalizeMetrics({
    trace,
    status,
    submittedAt,
    resultSummaryBase,
    fallbackNowMs,
  });
  await finalizeRequestLog(logId, {
    ...patch,
    status,
    durationMs: metrics.durationMs,
    completedAt: new Date(metrics.completedAtMs),
    resultSummary: metrics.resultSummary,
  });
}
