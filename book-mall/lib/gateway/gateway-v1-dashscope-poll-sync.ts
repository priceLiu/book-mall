/**
 * DashScope / 百炼 R2V · Gateway 日志轮询收口（HTTP recordInfo 与电商进程内 poll 共用）。
 */
import type { GatewayRequestLog } from "@prisma/client";

import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import {
  buildGatewayLogProgressSummary,
  touchGatewayLogProgress,
} from "@/lib/gateway/log-progress";
import {
  persistDashscopeTimingOnPoll,
  finalizeDashscopeAsyncRequestLog,
} from "@/lib/gateway/log-dashscope-timing-persist";
import { readDashscopeTimingTrace } from "@/lib/gateway/log-dashscope-timing";
import { dashscopeVideoFinalizeExtras } from "@/lib/gateway/dashscope-video-finalize-extras";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import {
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import { readVendorRequestIdFromJson } from "@/lib/gateway/vendor-request-id";

export async function syncDashscopePollToGatewayLog(input: {
  log: GatewayRequestLog;
  taskId: string;
  output: DashscopeTaskOutput | Record<string, unknown>;
  raw: unknown;
  providerKind: "DASHSCOPE" | "BAILIAN";
}): Promise<void> {
  const { log, taskId, output, raw, providerKind } = input;
  const status = String(
    (output as DashscopeTaskOutput).task_status ?? "RUNNING",
  );
  const polledAtMs = Date.now();

  if (isDashscopeTaskSuccess(status)) {
    const baseSummary = buildGatewayTaskResultSummary(raw, output);
    const videoExtras = dashscopeVideoFinalizeExtras(log, baseSummary);
    const { resultSummary } = await persistDashscopeTimingOnPoll({
      log,
      vendorStatus: status,
      vendorOutput: output,
      resultSummaryOverride: videoExtras.resultSummary,
    });
    const trace = readDashscopeTimingTrace(resultSummary);
    const tierRaw = videoExtras.pricingTierRaw;
    if (trace) {
      await finalizeDashscopeAsyncRequestLog(log.id, {
        submittedAt: log.submittedAt,
        status: "SUCCEEDED",
        trace,
        resultSummaryBase: resultSummary,
        fallbackNowMs: polledAtMs,
        externalTaskId: taskId,
        model: log.model,
        pricingTierRaw: tierRaw,
      });
    } else {
      const vendorRequestId =
        readVendorRequestIdFromJson(baseSummary) ?? undefined;
      await finalizeRequestLog(log.id, {
        status: "SUCCEEDED",
        durationMs: log.submittedAt
          ? polledAtMs - log.submittedAt.getTime()
          : 0,
        completedAt: new Date(polledAtMs),
        resultSummary: videoExtras.resultSummary,
        externalTaskId: taskId,
        model: log.model,
        pricingTierRaw: tierRaw,
        ...(vendorRequestId ? { vendorRequestId } : {}),
      });
    }
    return;
  }

  if (isDashscopeTaskFailed(status)) {
    const out = output as DashscopeTaskOutput;
    const { resultSummary } = await persistDashscopeTimingOnPoll({
      log,
      vendorStatus: status,
      vendorOutput: output,
      resultSummaryOverride: buildGatewayTaskResultSummary(raw, output),
    });
    const trace = readDashscopeTimingTrace(resultSummary);
    if (trace) {
      await finalizeDashscopeAsyncRequestLog(log.id, {
        submittedAt: log.submittedAt,
        status: "FAILED",
        trace,
        resultSummaryBase: resultSummary,
        fallbackNowMs: polledAtMs,
        failMessage: out.message ?? out.code ?? "failed",
        externalTaskId: taskId,
        model: log.model,
      });
    } else {
      const vendorRequestId =
        readVendorRequestIdFromJson(resultSummary) ?? undefined;
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: log.submittedAt
          ? polledAtMs - log.submittedAt.getTime()
          : 0,
        completedAt: new Date(polledAtMs),
        failMessage: out.message ?? out.code ?? "failed",
        externalTaskId: taskId,
        model: log.model,
        resultSummary,
        ...(vendorRequestId ? { vendorRequestId } : {}),
      });
    }
    return;
  }

  await persistDashscopeTimingOnPoll({
    log,
    vendorStatus: status || "RUNNING",
    vendorOutput: output,
    resultSummaryOverride: buildGatewayLogProgressSummary({
      providerKind,
      status: status || "RUNNING",
    }),
  });
}
