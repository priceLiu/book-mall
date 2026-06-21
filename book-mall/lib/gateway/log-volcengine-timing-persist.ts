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

/** DB 可用时：按「厂商停更时长」收口卡死的 RUNNING 火山视频日志并释放槽位 */
export async function expireVolcengineGatewayPollStalledLogs(
  nowMs: number = Date.now(),
): Promise<number> {
  const {
    isVolcengineVendorStuck,
    volcengineVendorStaleMs,
    VOLCENGINE_VENDOR_STALE_RELEASE_MS,
    readVolcengineTimingTrace,
    computeVolcengineTimingBreakdown,
    attachGatewayTimingToSummary,
  } = await import("@/lib/gateway/log-volcengine-timing");

  // 粗筛：提交已超过阈值的 running 任务才可能卡死（命中 [status, submittedAt] 索引）；
  // 精判用厂商停更时长（vendor updated_at），不再依赖 lastPolledAt 间断。
  const submittedCutoff = new Date(nowMs - VOLCENGINE_VENDOR_STALE_RELEASE_MS);
  const staleMin = Math.round(VOLCENGINE_VENDOR_STALE_RELEASE_MS / 60_000);

  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { lt: submittedCutoff },
    },
    select: {
      id: true,
      submittedAt: true,
      resultSummary: true,
    },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });

  let closed = 0;
  for (const row of rows) {
    const trace = readVolcengineTimingTrace(row.resultSummary);
    if (!trace) continue;
    if (!isVolcengineVendorStuck(trace, nowMs)) continue;

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
    const staleSec = Math.round((volcengineVendorStaleMs(trace, nowMs) ?? 0) / 1000);
    await finalizeRequestLog(row.id, {
      status: "FAILED",
      durationMs,
      failCode: "VOLCENGINE_GATEWAY_POLL_STALL",
      failMessage:
        `厂商已停更约 ${staleSec}s（超过 ${staleMin}min 自动收口阈值）仍未返回结果，判定卡死并已释放槽位。` +
        "请在厂商控制台核对任务；若确已生成，可在轮询池「恢复」。",
      resultSummary,
    });
    closed++;
  }
  return closed;
}
