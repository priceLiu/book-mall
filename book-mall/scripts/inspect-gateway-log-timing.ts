#!/usr/bin/env tsx
/** 按 log id 打印真实时间与拆分（运维诊断） */
import { prisma } from "../lib/prisma";
import {
  readVolcengineTimingTrace,
  computeVolcengineTimingBreakdown,
  resolveVendorNativeTimingForLogRow,
  resolveVolcengineLogTiming,
} from "../lib/gateway/log-volcengine-timing";
import { diagnoseGatewayPollStall } from "../lib/gateway/gateway-poll-stall-diagnostics";

const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const listRecent = process.argv.includes("--recent-running");

function sec(ms: number | null | undefined): number | null {
  return ms == null ? null : Math.round(ms / 1000);
}

async function inspectOne(id: string, nowMs: number) {
  const log = await prisma.gatewayRequestLog.findUnique({ where: { id } });
  if (!log) {
    console.log(JSON.stringify({ id, error: "NOT_FOUND" }));
    return;
  }
  const trace = readVolcengineTimingTrace(log.resultSummary);
  const submittedMs = log.submittedAt.getTime();
  const completedMs = log.completedAt?.getTime() ?? null;
  const our = resolveVolcengineLogTiming({
    providerKind: log.providerKind,
    requestKind: log.requestKind,
    submittedAt: log.submittedAt,
    completedAt: log.completedAt,
    resultSummary: log.resultSummary,
    nowMs,
  });
  const live = trace
    ? computeVolcengineTimingBreakdown({
        trace,
        submittedAtMs: submittedMs,
        completedAtMs: completedMs,
        nowMs,
      })
    : null;
  const vendor = resolveVendorNativeTimingForLogRow({
    providerKind: log.providerKind,
    requestKind: log.requestKind,
    vendorDurationMs: log.vendorDurationMs,
    resultSummary: log.resultSummary,
    nowMs,
  });
  let stall: unknown = null;
  try {
    stall = await diagnoseGatewayPollStall(id);
  } catch (e) {
    stall = { error: e instanceof Error ? e.message : String(e) };
  }

  console.log(
    JSON.stringify(
      {
        id,
        status: log.status,
        model: log.model,
        externalTaskId: log.externalTaskId,
        submittedAt: log.submittedAt.toISOString(),
        completedAt: log.completedAt?.toISOString() ?? null,
        durationMs: log.durationMs,
        vendorDurationMs: log.vendorDurationMs,
        wallSinceSubmittedSec: sec(nowMs - submittedMs),
        trace: trace
          ? {
              lastStatus: trace.lastStatus,
              vendorCreatedAt: trace.vendorCreatedAtMs
                ? new Date(trace.vendorCreatedAtMs).toISOString()
                : null,
              vendorUpdatedAt: trace.vendorUpdatedAtMs
                ? new Date(trace.vendorUpdatedAtMs).toISOString()
                : null,
              firstRunningAt: trace.firstRunningAtMs
                ? new Date(trace.firstRunningAtMs).toISOString()
                : null,
              lastPolledAt: trace.lastPolledAtMs
                ? new Date(trace.lastPolledAtMs).toISOString()
                : null,
              peakPollDelaySec: sec(trace.peakPollDelayMs),
              updatedFrozen:
                trace.vendorCreatedAtMs != null &&
                trace.vendorUpdatedAtMs != null &&
                trace.vendorUpdatedAtMs - trace.vendorCreatedAtMs <= 5000,
            }
          : null,
        ourTimingSec: our
          ? {
              queue: sec(our.queueMs),
              generate: sec(our.generateMs),
              postproc: sec(our.vendorPostProcessMs),
              pollDelay: sec(our.pollDelayMs),
            }
          : null,
        liveBreakdownSec: live
          ? {
              queue: sec(live.queueMs),
              generate: sec(live.generateMs),
              postproc: sec(live.vendorPostProcessMs),
              pollDelay: sec(live.pollDelayMs),
            }
          : null,
        vendorNativeSec: {
          duration: sec(vendor.vendorNativeDurationMs),
          generate: sec(vendor.vendorNativeGenerateMs),
        },
        stall,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const nowMs = Date.now();
  if (listRecent) {
    const from = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const logs = await prisma.gatewayRequestLog.findMany({
      where: {
        status: "RUNNING",
        providerKind: "VOLCENGINE",
        requestKind: "VIDEO",
        submittedAt: { gte: from },
      },
      orderBy: { submittedAt: "desc" },
      select: { id: true, submittedAt: true, model: true },
      take: 20,
    });
    console.log(JSON.stringify({ recentRunningCount: logs.length }, null, 2));
    for (const row of logs) await inspectOne(row.id, nowMs);
    return;
  }
  if (!ids.length) {
    console.error(
      "Usage: tsx scripts/inspect-gateway-log-timing.ts <logId>... | --recent-running",
    );
    process.exit(1);
  }
  for (const id of ids) {
    const exact = await prisma.gatewayRequestLog.findUnique({ where: { id } });
    if (exact) {
      await inspectOne(id, nowMs);
      continue;
    }
    const canvasTask = await prisma.canvasGenerationTask.findUnique({
      where: { id },
      select: { inputPayload: true },
    });
    const gwId =
      canvasTask?.inputPayload &&
      typeof canvasTask.inputPayload === "object" &&
      !Array.isArray(canvasTask.inputPayload)
        ? String(
            (canvasTask.inputPayload as Record<string, unknown>).gatewayLogId ??
              "",
          ).trim()
        : "";
    if (gwId) {
      console.log(JSON.stringify({ queriedAs: "canvasTaskId", gatewayLogId: gwId }));
      await inspectOne(gwId, nowMs);
      continue;
    }
    console.log(JSON.stringify({ id, error: "NOT_FOUND" }));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
