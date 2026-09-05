/**
 * wan2.2-s2v 对账缺口排查（AR-105）：Gateway 计量 vs 音频时长 / 厂商 CSV 预期。
 */
import { resolveReconciliationVideoSeconds } from "./billable-units";
import { inferS2vVideoSecondsFromLog } from "@/lib/finance/infer-s2v-video-seconds";
import { prisma } from "@/lib/prisma";
import {
  normalizePeriod,
  periodQueryBounds,
  type ReconciliationPeriod,
} from "./period-range";

export type S2vGapAuditRow = {
  logId: string;
  submittedAt: string;
  modelKey: string;
  gatewaySeconds: number;
  inferredSeconds: number | null;
  gapSeconds: number;
  clientPage: string | null;
  composeTaskId: string | null;
  audioDurationSec: number | null;
  issue: string;
};

export type S2vGapAuditReport = {
  period: ReconciliationPeriod;
  gatewayLogCount: number;
  gatewaySecondsTotal: number;
  inferredSecondsTotal: number;
  gapSecondsTotal: number;
  missingDurationCount: number;
  composeTasksWithoutGatewayLog: number;
  composeAudioSecondsTotal: number;
  rows: S2vGapAuditRow[];
};

const S2V_WHERE = {
  status: "SUCCEEDED" as const,
  OR: [{ model: "wan2.2-s2v" }, { canonicalModelKey: "wan2.2-s2v" }],
};

export async function auditS2vReconciliationGap(input: {
  period: ReconciliationPeriod;
  take?: number;
}): Promise<S2vGapAuditReport> {
  const period = normalizePeriod(input.period);
  const { from, to } = periodQueryBounds(period);
  const take = Math.min(200, Math.max(1, input.take ?? 100));

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      ...S2V_WHERE,
      submittedAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      model: true,
      canonicalModelKey: true,
      requestKind: true,
      inputSummary: true,
      resultSummary: true,
      clientPage: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: "desc" },
    take: 500,
  });

  const composeTasks = await prisma.aiSpaceComposeTask.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: "completed",
    },
    select: {
      id: true,
      gatewayLogId: true,
      audioAssetId: true,
    },
  });

  const audioIds = [...new Set(composeTasks.map((t) => t.audioAssetId))];
  const audioRows =
    audioIds.length > 0
      ? await prisma.aiSpaceAudioAsset.findMany({
          where: { id: { in: audioIds } },
          select: { id: true, durationSec: true },
        })
      : [];
  const audioById = new Map(audioRows.map((a) => [a.id, a.durationSec]));

  const logToCompose = new Map<string, { taskId: string; audioSec: number | null }>();
  for (const t of composeTasks) {
    if (t.gatewayLogId) {
      logToCompose.set(t.gatewayLogId, {
        taskId: t.id,
        audioSec: audioById.get(t.audioAssetId) ?? null,
      });
    }
  }

  const rows: S2vGapAuditRow[] = [];
  let gatewaySecondsTotal = 0;
  let inferredSecondsTotal = 0;
  let missingDurationCount = 0;

  for (const log of logs) {
    const compose = logToCompose.get(log.id);
    const inferred = inferS2vVideoSecondsFromLog({
      ...log,
      audioDurationSecFallback: compose?.audioSec ?? null,
    });
    const gatewaySeconds = resolveReconciliationVideoSeconds(log);
    gatewaySecondsTotal += gatewaySeconds;
    if (inferred != null) inferredSecondsTotal += inferred;

    const gapSeconds = (inferred ?? gatewaySeconds) - gatewaySeconds;
    let issue = "";
    if (gatewaySeconds <= 0 && inferred != null && inferred > 0) {
      issue = "缺 usage.duration，可回填";
      missingDurationCount += 1;
    } else if (gatewaySeconds <= 0 && inferred == null) {
      issue = "无法推断成片秒";
      missingDurationCount += 1;
    } else if (compose?.audioSec != null && Math.abs(gatewaySeconds - compose.audioSec) > 1) {
      issue = `Gateway ${gatewaySeconds}s ≠ 音频 ${compose.audioSec}s`;
    }

    if (issue || gatewaySeconds <= 0) {
      rows.push({
        logId: log.id,
        submittedAt: log.submittedAt?.toISOString() ?? "",
        modelKey: log.canonicalModelKey ?? log.model ?? "",
        gatewaySeconds,
        inferredSeconds: inferred,
        gapSeconds,
        clientPage: log.clientPage,
        composeTaskId: compose?.taskId ?? null,
        audioDurationSec: compose?.audioSec ?? null,
        issue: issue || "OK",
      });
    }
  }

  rows.sort((a, b) => Math.abs(b.gapSeconds) - Math.abs(a.gapSeconds));

  const composeTasksWithoutGatewayLog = composeTasks.filter((t) => !t.gatewayLogId).length;
  const composeAudioSecondsTotal = composeTasks.reduce(
    (s, t) => s + (audioById.get(t.audioAssetId) ?? 0),
    0,
  );

  return {
    period,
    gatewayLogCount: logs.length,
    gatewaySecondsTotal: Math.round(gatewaySecondsTotal * 100) / 100,
    inferredSecondsTotal: Math.round(inferredSecondsTotal * 100) / 100,
    gapSecondsTotal:
      Math.round((inferredSecondsTotal - gatewaySecondsTotal) * 100) / 100,
    missingDurationCount,
    composeTasksWithoutGatewayLog,
    composeAudioSecondsTotal: Math.round(composeAudioSecondsTotal * 100) / 100,
    rows: rows.slice(0, take),
  };
}
