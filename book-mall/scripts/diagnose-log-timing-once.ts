#!/usr/bin/env tsx
import { prisma } from "@/lib/prisma";
import {
  readVolcengineTimingBreakdown,
  readVolcengineTimingTrace,
  resolveVolcengineLogTiming,
  sumVolcengineTimingBreakdownMs,
} from "@/lib/gateway/log-volcengine-timing";

const id = process.argv[2] ?? "cmqs2cyj703x9rm0142k9un9y";

function sec(ms: number | null | undefined): number | null {
  if (ms == null) return null;
  return Math.round(ms / 1000);
}

function breakdownSec(b: Record<string, unknown> | null) {
  if (!b) return null;
  return Object.fromEntries(
    Object.entries(b).map(([k, v]) => [k, typeof v === "number" ? sec(v) : v]),
  );
}

async function main() {
  const log = await prisma.gatewayRequestLog.findUnique({ where: { id } });
  let gatewaySubmittedAt: Date | null = null;
  if (!log) {
    console.log("gateway log not found by id", id);
  } else {
    gatewaySubmittedAt = log.submittedAt;
    const nowMs = Date.now();
    const breakdown = resolveVolcengineLogTiming({
      providerKind: log.providerKind,
      requestKind: log.requestKind,
      submittedAt: log.submittedAt,
      completedAt: log.completedAt,
      resultSummary: log.resultSummary,
      nowMs,
    });
    const stored = readVolcengineTimingBreakdown(log.resultSummary);
    const trace = readVolcengineTimingTrace(log.resultSummary);
    const completedMs = log.completedAt?.getTime() ?? nowMs;
    const phaseSum = breakdown
      ? sumVolcengineTimingBreakdownMs({
          breakdown,
          submittedAtMs: log.submittedAt.getTime(),
          completedAtMs: completedMs,
        })
      : null;

    console.log(
      JSON.stringify(
        {
          type: "gateway",
          id: log.id,
          status: log.status,
          providerKind: log.providerKind,
          requestKind: log.requestKind,
          submittedAt: log.submittedAt.toISOString(),
          completedAt: log.completedAt?.toISOString() ?? null,
          durationMs: log.durationMs,
          durationSec: sec(log.durationMs),
          wallSec: sec(nowMs - log.submittedAt.getTime()),
          completedMinusSubmittedSec: log.completedAt
            ? sec(log.completedAt.getTime() - log.submittedAt.getTime())
            : null,
          storedBreakdownSec: breakdownSec(stored as Record<string, unknown> | null),
          resolvedBreakdownSec: breakdownSec(breakdown as Record<string, unknown> | null),
          phaseSumSec: sec(phaseSum),
          durationVsPhaseSumDeltaSec:
            log.durationMs != null && phaseSum != null
              ? sec(log.durationMs - phaseSum)
              : null,
          trace: trace
            ? {
                firstSucceededPolledAtMs: trace.firstSucceededPolledAtMs,
                firstRunningAtMs: trace.firstRunningAtMs,
                vendorCreatedAtMs: trace.vendorCreatedAtMs,
                vendorUpdatedAtMs: trace.vendorUpdatedAtMs,
                lastPolledAtMs: trace.lastPolledAtMs,
                lastStatus: trace.lastStatus,
              }
            : null,
        },
        null,
        2,
      ),
    );
  }

  const task = await prisma.canvasGenerationTask.findFirst({
    where: {
      OR: [{ id }, { inputPayload: { path: ["gatewayLogId"], equals: id } }],
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      queuedAt: true,
      submittedAt: true,
      completedAt: true,
      inputPayload: true,
    },
  });
  if (task) {
    const gwId = (task.inputPayload as Record<string, unknown>)?.gatewayLogId;
    const nowMs = Date.now();
    console.log(
      JSON.stringify(
        {
          type: "canvas_task",
          id: task.id,
          gatewayLogId: gwId,
          status: task.status,
          createdAt: task.createdAt.toISOString(),
          queuedAt: task.queuedAt?.toISOString() ?? null,
          submittedAt: task.submittedAt?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          e2eWallSec: sec(nowMs - task.createdAt.getTime()),
          preGatewaySec:
            gatewaySubmittedAt && task.createdAt
              ? sec(gatewaySubmittedAt.getTime() - task.createdAt.getTime())
              : null,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("canvas task not found for", id);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
