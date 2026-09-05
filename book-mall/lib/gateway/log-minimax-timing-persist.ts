import type { GatewayRequestLog } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { MinimaxVideoTaskRow } from "@/lib/gateway/minimax-video-client";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/log-progress";
import {
  attachMinimaxTimingToSummary,
  buildMinimaxTerminalFinalizeMetrics,
  bumpMinimaxPeakPollDelay,
  computeMinimaxTimingBreakdown,
  mergeMinimaxTimingTrace,
  mergeMinimaxVendorSnapshot,
  readMinimaxTimingTrace,
  type MinimaxTimingBreakdown,
} from "@/lib/gateway/log-minimax-timing";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";

/** MiniMax 视频轮询：写入状态轨迹 + 实时耗时拆分 */
export async function persistMinimaxTimingOnPoll(input: {
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
  task: MinimaxVideoTaskRow;
  raw?: unknown;
  resultSummaryOverride?: unknown;
}): Promise<{
  breakdown: MinimaxTimingBreakdown;
  resultSummary: Record<string, unknown>;
}> {
  const polledAtMs = Date.now();
  const trace = mergeMinimaxTimingTrace(
    readMinimaxTimingTrace(input.log.resultSummary),
    {
      status: input.vendorStatus,
      task: input.task,
      polledAtMs,
    },
  );
  const breakdown = computeMinimaxTimingBreakdown({
    trace,
    submittedAtMs: input.log.submittedAt.getTime(),
    completedAtMs: input.log.completedAt?.getTime() ?? null,
    nowMs: polledAtMs,
  });
  const traceWithPeak = bumpMinimaxPeakPollDelay(trace, breakdown.pollDelayMs);
  const breakdownFinal = computeMinimaxTimingBreakdown({
    trace: traceWithPeak,
    submittedAtMs: input.log.submittedAt.getTime(),
    completedAtMs: input.log.completedAt?.getTime() ?? null,
    nowMs: polledAtMs,
  });

  const pollBase = mergeMinimaxVendorSnapshot(
    input.resultSummaryOverride ?? input.log.resultSummary,
    input.raw,
    input.task,
  );
  const nextSummary = attachMinimaxTimingToSummary(
    pollBase,
    traceWithPeak,
    breakdownFinal,
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

type MinimaxFinalizePatch = Omit<
  Parameters<typeof finalizeRequestLog>[1],
  "status" | "durationMs" | "resultSummary" | "completedAt" | "vendorDurationMs"
>;

export async function finalizeMinimaxVideoRequestLog(
  logId: string,
  input: {
    submittedAt: Date;
    status: "SUCCEEDED" | "FAILED";
    trace: import("@/lib/gateway/log-minimax-timing").MinimaxTimingTrace;
    resultSummaryBase: unknown;
    fallbackNowMs?: number;
  } & MinimaxFinalizePatch,
): Promise<void> {
  const { submittedAt, status, trace, resultSummaryBase, fallbackNowMs, ...patch } =
    input;
  const metrics = buildMinimaxTerminalFinalizeMetrics({
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
    vendorDurationMs: metrics.vendorDurationMs ?? undefined,
    resultSummary: metrics.resultSummary,
  });
}
