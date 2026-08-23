/**
 * KIE 异步 Gateway 看门狗：三态判定（正常等待 / 平台阻塞 recover / DB 释放重试）。
 */
import type { Prisma } from "@prisma/client";

import {
  attachKieWatchdogChannelMeta,
  kieWatchdogChannelFailMax,
  kieWatchdogChannelFailMinAgeMs,
  kieWatchdogLimit,
  kieWatchdogMinRunIntervalMs,
  readKieWatchdogChannelMeta,
} from "@/lib/gateway/gateway-kie-watchdog-policy";
import {
  attachWatchdogLastRecoverAtMs,
  readWatchdogLastRecoverAtMs,
} from "@/lib/gateway/gateway-video-watchdog-policy";
import { syncKieGatewayLogFromVendorPoll } from "@/lib/gateway/kie-gateway-log-sync";
import {
  classifyKieGatewayWatchdogRow,
  classifyWatchdogSyncError,
  type GatewayWatchdogVerdict,
} from "@/lib/gateway/gateway-watchdog-classifier";
import { releaseWatchdogDbPressure } from "@/lib/gateway/gateway-watchdog-db-recover";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { isPrismaPoolTimeoutError } from "@/lib/prisma-db-gate";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { isKieRecordInFlight } from "@/lib/story/kie-client";
import { prisma } from "@/lib/prisma";

let lastRunAt = 0;
let running = false;

export type GatewayKieWatchdogResult = {
  ran: boolean;
  inflight?: number;
  continued?: number;
  recovered?: number;
  failed?: number;
  dbRetried?: number;
};

async function markWatchdogRecoverAttempt(
  logId: string,
  resultSummary: unknown,
): Promise<void> {
  const next = attachWatchdogLastRecoverAtMs(resultSummary, Date.now());
  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: { resultSummary: next as Prisma.InputJsonValue },
  });
}

async function loadLogResultSummary(logId: string): Promise<unknown> {
  const row = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { resultSummary: true },
  });
  return row?.resultSummary ?? null;
}

async function patchChannelMeta(
  logId: string,
  resultSummary: unknown,
  patch: Parameters<typeof attachKieWatchdogChannelMeta>[1],
): Promise<void> {
  const next = attachKieWatchdogChannelMeta(resultSummary, patch);
  await prisma.gatewayRequestLog.update({
    where: { id: logId },
    data: { resultSummary: next as Prisma.InputJsonValue },
  });
}

async function recordVendorFailure(
  logId: string,
  resultSummary: unknown,
  error: string,
): Promise<number> {
  const prev = readKieWatchdogChannelMeta(resultSummary);
  const consecutiveVendorFailures =
    (prev.consecutiveVendorFailures ?? prev.consecutiveFailures ?? 0) + 1;
  await patchChannelMeta(logId, resultSummary, {
    consecutiveVendorFailures,
    consecutiveFailures: consecutiveVendorFailures,
    consecutiveDbFailures: 0,
    lastError: error.slice(0, 500),
    lastErrorAt: new Date().toISOString(),
  });
  return consecutiveVendorFailures;
}

async function recordDbFailure(
  logId: string,
  resultSummary: unknown,
  error: string,
): Promise<void> {
  const prev = readKieWatchdogChannelMeta(resultSummary);
  await patchChannelMeta(logId, resultSummary, {
    consecutiveDbFailures: (prev.consecutiveDbFailures ?? 0) + 1,
    lastError: error.slice(0, 500),
    lastErrorAt: new Date().toISOString(),
  });
}

async function clearChannelFailures(
  logId: string,
  resultSummary: unknown,
  vendorState?: string,
): Promise<void> {
  await patchChannelMeta(logId, resultSummary, {
    consecutiveVendorFailures: 0,
    consecutiveDbFailures: 0,
    consecutiveFailures: 0,
    lastError: undefined,
    lastErrorAt: undefined,
    lastVendorState: vendorState,
    lastVendorStateAt: vendorState
      ? new Date().toISOString()
      : undefined,
  });
}

async function failKieGatewayLog(
  logId: string,
  opts: {
    submittedAt: Date | null;
    failCode: string;
    failMessage: string;
  },
): Promise<void> {
  const durationMs = opts.submittedAt
    ? Date.now() - opts.submittedAt.getTime()
    : 0;
  await finalizeRequestLog(logId, {
    status: "FAILED",
    durationMs,
    failCode: opts.failCode,
    failMessage: opts.failMessage.slice(0, 500),
  });
}

function decisionLogEnabled(): boolean {
  return (
    process.env.GATEWAY_KIE_WATCHDOG_LOG === "1" ||
    process.env.GATEWAY_VIDEO_WATCHDOG_LOG === "1"
  );
}

function logVerdict(
  source: string | undefined,
  logId: string,
  verdict: GatewayWatchdogVerdict,
): void {
  if (!decisionLogEnabled()) return;
  console.info(
    "[gateway-kie-watchdog] verdict",
    JSON.stringify({ source: source ?? "unknown", logId, ...verdict }),
  );
}

export async function runGatewayKieWatchdog(opts?: {
  source?: string;
}): Promise<GatewayKieWatchdogResult> {
  const now = Date.now();
  if (running) return { ran: false };
  if (now - lastRunAt < kieWatchdogMinRunIntervalMs()) return { ran: false };
  running = true;
  lastRunAt = now;

  let continued = 0;
  let recovered = 0;
  let failed = 0;
  let dbRetried = 0;

  try {
    const rows = await prisma.gatewayRequestLog.findMany({
      where: { status: "RUNNING", providerKind: "KIE" },
      orderBy: { submittedAt: "asc" },
      take: Math.max(kieWatchdogLimit() * 3, 24),
      select: {
        id: true,
        status: true,
        model: true,
        requestKind: true,
        externalTaskId: true,
        credentialId: true,
        submittedAt: true,
        lastPolledAt: true,
        pollCount: true,
        resultSummary: true,
      },
    });

    if (rows.length === 0) {
      return { ran: true, inflight: 0, continued: 0, recovered: 0, failed: 0 };
    }

    const recoverBatch: typeof rows = [];

    for (const row of rows) {
      const verdict = classifyKieGatewayWatchdogRow({
        ...row,
        nowMs: now,
      });
      logVerdict(opts?.source, row.id, verdict);

      if (verdict.outcome === "continue") {
        continued += 1;
        continue;
      }

      if (verdict.outcome === "db_release_retry") {
        dbRetried += 1;
        await releaseWatchdogDbPressure(new Error(verdict.hint));
        await recordDbFailure(row.id, row.resultSummary, verdict.hint);
        continue;
      }

      if (verdict.outcome === "fail") {
        await failKieGatewayLog(row.id, {
          submittedAt: row.submittedAt,
          failCode: verdict.failCode,
          failMessage: verdict.hint,
        });
        failed += 1;
        continue;
      }

      recoverBatch.push(row);
    }

    await mapWithConcurrency(
      recoverBatch.slice(0, kieWatchdogLimit()),
      async (row) => {
        try {
          const synced = await syncKieGatewayLogFromVendorPoll(row.id);

          if (synced.status === "SUCCEEDED" || synced.status === "FAILED") {
            recovered += 1;
            const freshSummary = await loadLogResultSummary(row.id);
            await clearChannelFailures(
              row.id,
              freshSummary,
              synced.record.state,
            );
            return;
          }

          await markWatchdogRecoverAttempt(
            row.id,
            await loadLogResultSummary(row.id),
          );

          const afterVerdict = classifyKieGatewayWatchdogRow({
            ...row,
            nowMs: Date.now(),
            lastVendorRecord: synced.record,
          });

          if (afterVerdict.outcome === "continue") {
            continued += 1;
            await clearChannelFailures(
              row.id,
              await loadLogResultSummary(row.id),
              synced.record.state,
            );
            logVerdict(opts?.source, row.id, afterVerdict);
            return;
          }

          if (afterVerdict.outcome === "fail") {
            await failKieGatewayLog(row.id, {
              submittedAt: row.submittedAt,
              failCode: afterVerdict.failCode,
              failMessage: afterVerdict.hint,
            });
            failed += 1;
            return;
          }

          if (isKieRecordInFlight(synced.record.state)) {
            continued += 1;
            await clearChannelFailures(
              row.id,
              await loadLogResultSummary(row.id),
              synced.record.state,
            );
          }
        } catch (e) {
          const syncVerdict = classifyWatchdogSyncError(e);
          const msg = e instanceof Error ? e.message : String(e);

          if (syncVerdict.outcome === "db_release_retry") {
            dbRetried += 1;
            await releaseWatchdogDbPressure(e);
            await recordDbFailure(row.id, row.resultSummary, msg);
            return;
          }

          const failures = await recordVendorFailure(
            row.id,
            row.resultSummary,
            msg,
          );
          console.warn(
            "[gateway-kie-watchdog] vendor sync failed",
            JSON.stringify({
              source: opts?.source ?? "unknown",
              logId: row.id,
              error: msg.slice(0, 200),
              consecutiveVendorFailures: failures,
            }),
          );

          const ageMs = row.submittedAt
            ? Date.now() - row.submittedAt.getTime()
            : 0;
          if (
            failures >= kieWatchdogChannelFailMax() &&
            ageMs >= kieWatchdogChannelFailMinAgeMs() &&
            !isPrismaPoolTimeoutError(e)
          ) {
            await failKieGatewayLog(row.id, {
              submittedAt: row.submittedAt,
              failCode: "POLL_CHANNEL_ERROR",
              failMessage: msg.slice(0, 500),
            });
            failed += 1;
          }
        }
      },
      Math.min(4, recoverBatch.length || 1),
    );

    return {
      ran: true,
      inflight: rows.length,
      continued,
      recovered,
      failed,
      dbRetried,
    };
  } finally {
    running = false;
  }
}
