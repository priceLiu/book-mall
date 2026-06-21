import type { GatewayRequestLog } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/log-progress";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import {
  attachGatewayTimingToSummary,
  computeVolcengineTimingBreakdown,
  isVolcengineVendorUpdatedStale,
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

  const vendorStalled =
    !isGatewayLogTerminalStatus(input.log.status) &&
    isVolcengineVendorUpdatedStale(trace, polledAtMs);

  if (vendorStalled) {
    const durationMs = input.log.submittedAt
      ? polledAtMs - input.log.submittedAt.getTime()
      : 0;
    await finalizeRequestLog(input.log.id, {
      status: "FAILED",
      durationMs,
      failCode: "VOLCENGINE_VENDOR_STALE",
      failMessage:
        "Volcengine 任务 updated_at 已停更超过 10 分钟且仍为进行中，判定厂商卡死；请在控制台核对或重试",
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
