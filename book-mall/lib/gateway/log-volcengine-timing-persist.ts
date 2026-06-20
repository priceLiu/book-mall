import type { GatewayRequestLog } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/log-progress";
import {
  attachGatewayTimingToSummary,
  computeVolcengineTimingBreakdown,
  mergeVolcengineTimingTrace,
  readVolcengineTimingTrace,
  type VolcengineTimingBreakdown,
} from "@/lib/gateway/log-volcengine-timing";

/** 火山视频轮询：写入状态轨迹 + 实时耗时拆分（不覆盖终态 resultSummary）。 */
export async function persistVolcengineTimingOnPoll(input: {
  log: Pick<
    GatewayRequestLog,
    "id" | "submittedAt" | "completedAt" | "resultSummary" | "status"
  >;
  vendorStatus: string;
  vendorRaw: unknown;
  /** 成功/失败 finalize 前可传入，用于写入最终 resultSummary */
  resultSummaryOverride?: unknown;
}): Promise<{
  breakdown: VolcengineTimingBreakdown;
  resultSummary: Record<string, unknown>;
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

  if (!isGatewayLogTerminalStatus(input.log.status)) {
    await prisma.gatewayRequestLog.updateMany({
      where: {
        id: input.log.id,
        status: { notIn: ["SUCCEEDED", "FAILED", "CANCELLED"] },
      },
      data: {
        resultSummary: nextSummary,
        lastPolledAt: new Date(polledAtMs),
        pollCount: { increment: 1 },
      },
    });
  }

  return { breakdown, resultSummary: nextSummary };
}
