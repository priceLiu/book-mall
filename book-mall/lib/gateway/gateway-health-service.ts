/**
 * Gateway 阻塞扫描 + 安全自愈。
 * 扫描只读计数；heal 只编排已有收口（expire / 视频·KIE 看门狗 / Canvas 重排 / 计数纠偏）。
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canvasStaleDispatchMs,
  chatLongWarnMs,
  healthHealChatLimit,
  pollWorkerStaleMs,
  staleChatStreamMs,
  staleNonVideoAsyncMs,
  staleVideoHardMs,
  staleVideoWarnMs,
} from "@/lib/gateway/gateway-health-policy";
import {
  evaluateGatewayHealthAlerts,
  gatewayHealthOpsStatus,
  type GatewayHealthCounts,
  type GatewayHealthHealReport,
  type GatewayHealthSample,
  type GatewayHealthSnapshot,
} from "@/lib/gateway/gateway-health-alerts";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { recordPlatformError } from "@/lib/platform-error-log";
import { readGatewayPollWorkerHeartbeat } from "@/lib/gateway/gateway-poll-stall-diagnostics";

export type {
  GatewayHealthHealReport,
  GatewayHealthSample,
  GatewayHealthSnapshot,
};

const SAMPLE_TAKE = 8;
const HISTORY_MAX = 10;
const SERVICE_BOOT_AT = Date.now();

type GlobalHealth = typeof globalThis & {
  __gatewayHealthLastHeal?: GatewayHealthHealReport | null;
  __gatewayHealthLastHealAt?: string | null;
  __gatewayHealthHistory?: GatewayHealthSnapshot[];
};

function g(): GlobalHealth {
  return globalThis as GlobalHealth;
}

function rememberSnapshot(snap: GatewayHealthSnapshot): void {
  const hist = g().__gatewayHealthHistory ?? [];
  hist.unshift(snap);
  g().__gatewayHealthHistory = hist.slice(0, HISTORY_MAX);
}

export function readGatewayHealthHistory(): GatewayHealthSnapshot[] {
  return [...(g().__gatewayHealthHistory ?? [])];
}

function residentPollEnabled(): boolean {
  const v = process.env.GATEWAY_POLL_RESIDENT?.trim().toLowerCase();
  return !(v === "0" || v === "false");
}

function toSample(row: {
  id: string;
  model: string;
  requestKind: string;
  submittedAt: Date;
}): GatewayHealthSample {
  return {
    id: row.id,
    model: row.model,
    requestKind: row.requestKind,
    submittedAt: row.submittedAt.toISOString(),
    ageSec: Math.max(0, Math.round((Date.now() - row.submittedAt.getTime()) / 1000)),
  };
}

async function countAndSample(where: Prisma.GatewayRequestLogWhereInput) {
  const [count, rows] = await Promise.all([
    prisma.gatewayRequestLog.count({ where }),
    prisma.gatewayRequestLog.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      take: SAMPLE_TAKE,
      select: { id: true, model: true, requestKind: true, submittedAt: true },
    }),
  ]);
  return { count, samples: rows.map(toSample) };
}

export async function scanGatewayHealth(opts?: {
  source?: string;
}): Promise<GatewayHealthSnapshot> {
  const now = Date.now();
  const chatOrphanCutoff = new Date(now - staleChatStreamMs());
  const chatLongCutoff = new Date(now - chatLongWarnMs());
  const asyncCutoff = new Date(now - staleNonVideoAsyncMs());
  const videoWarnCutoff = new Date(now - staleVideoWarnMs());
  const videoHardCutoff = new Date(now - staleVideoHardMs());
  const canvasCutoff = new Date(now - canvasStaleDispatchMs());

  const [
    staleChat,
    chatLongCount,
    staleAsync,
    staleVideo,
    videoHardCount,
    inflight,
    canvasStaleDispatch,
  ] = await Promise.all([
    countAndSample({
      status: "RUNNING",
      requestKind: "CHAT",
      externalTaskId: null,
      submittedAt: { lt: chatOrphanCutoff },
    }),
    prisma.gatewayRequestLog.count({
      where: {
        status: "RUNNING",
        requestKind: "CHAT",
        externalTaskId: null,
        submittedAt: { lt: chatLongCutoff, gte: chatOrphanCutoff },
      },
    }),
    countAndSample({
      status: "RUNNING",
      requestKind: { not: "VIDEO" },
      externalTaskId: { not: null },
      submittedAt: { lt: asyncCutoff },
    }),
    countAndSample({
      status: "RUNNING",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { lt: videoWarnCutoff },
    }),
    prisma.gatewayRequestLog.count({
      where: {
        status: "RUNNING",
        requestKind: "VIDEO",
        submittedAt: { lt: videoHardCutoff },
      },
    }),
    prisma.gatewayRequestLog.count({
      where: { status: { in: ["PENDING", "RUNNING"] } },
    }),
    prisma.canvasGenerationTask.count({
      where: {
        status: { in: ["QUEUED", "DISPATCHING"] },
        deletedAt: null,
        OR: [
          { queuedAt: { lt: canvasCutoff } },
          { queuedAt: null, createdAt: { lt: canvasCutoff } },
        ],
      },
    }),
  ]);

  const hb = readGatewayPollWorkerHeartbeat();
  let pollWorkerStale = false;
  let pollWorkerAgeMs: number | null = null;
  if (residentPollEnabled()) {
    if (hb.lastOkAt > 0) {
      pollWorkerAgeMs = now - hb.lastOkAt;
      pollWorkerStale = pollWorkerAgeMs >= pollWorkerStaleMs();
    } else if (now - SERVICE_BOOT_AT >= pollWorkerStaleMs()) {
      pollWorkerAgeMs = null;
      pollWorkerStale = true;
    }
  }

  const counts: GatewayHealthCounts = {
    staleChat: staleChat.count,
    chatLong: chatLongCount,
    staleAsync: staleAsync.count,
    staleVideo: staleVideo.count,
    videoHard: videoHardCount,
    canvasStaleDispatch,
    inflight,
    pollWorkerStale,
    pollWorkerAgeMs,
  };
  const alerts = evaluateGatewayHealthAlerts(counts);
  const snap: GatewayHealthSnapshot = {
    scannedAt: new Date(now).toISOString(),
    source: opts?.source ?? "manual",
    opsHealth: gatewayHealthOpsStatus(alerts),
    counts,
    alerts,
    samples: {
      staleChat: staleChat.samples,
      staleVideo: staleVideo.samples,
      staleAsync: staleAsync.samples,
    },
    lastHeal: g().__gatewayHealthLastHeal ?? null,
    lastHealAt: g().__gatewayHealthLastHealAt ?? null,
  };
  rememberSnapshot(snap);
  return snap;
}

async function closeStaleChatOrphans(): Promise<number> {
  const cutoff = new Date(Date.now() - staleChatStreamMs());
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      requestKind: "CHAT",
      externalTaskId: null,
      submittedAt: { lt: cutoff },
    },
    orderBy: { submittedAt: "asc" },
    take: healthHealChatLimit(),
    select: { id: true, submittedAt: true },
  });
  let closed = 0;
  for (const row of rows) {
    await finalizeRequestLog(row.id, {
      status: "FAILED",
      durationMs: Math.max(0, Date.now() - row.submittedAt.getTime()),
      failCode: "STALE_CHAT_ORPHAN",
      failMessage: "流式 Chat 长时间未收口（超过 15 分钟），已自动关闭",
    }).catch((e) => {
      console.warn(
        "[gateway-health] close stale chat failed",
        row.id,
        e instanceof Error ? e.message : e,
      );
    });
    closed += 1;
  }
  return closed;
}

async function reconcileStats(): Promise<boolean> {
  try {
    const { computeDashboardSummaryCards } = await import(
      "@/lib/gateway/log-dashboard-projection"
    );
    const { GATEWAY_STATS_GLOBAL_SCOPE, reconcileGatewayStatsCounter } =
      await import("@/lib/gateway/stats-counter");
    const cards = await computeDashboardSummaryCards({});
    await reconcileGatewayStatsCounter(GATEWAY_STATS_GLOBAL_SCOPE, cards);
    return true;
  } catch (e) {
    console.warn(
      "[gateway-health] stats reconcile failed",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

export async function healGatewayHealth(opts?: {
  source?: string;
}): Promise<{ before: GatewayHealthSnapshot; after: GatewayHealthSnapshot; heal: GatewayHealthHealReport }> {
  const before = await scanGatewayHealth({
    source: `${opts?.source ?? "manual"}:pre-heal`,
  });

  const staleChatClosed = await closeStaleChatOrphans();

  let expired = 0;
  try {
    const { expireStaleGatewayLogs } = await import("@/lib/gateway/poll-service");
    expired = await expireStaleGatewayLogs();
  } catch (e) {
    console.warn(
      "[gateway-health] expireStaleGatewayLogs failed",
      e instanceof Error ? e.message : e,
    );
  }

  let videoWatchdog: unknown = null;
  try {
    const { runGatewayVideoWatchdog } = await import(
      "@/lib/gateway/gateway-video-watchdog"
    );
    videoWatchdog = await runGatewayVideoWatchdog({
      source: "gateway-health-heal",
    });
  } catch (e) {
    videoWatchdog = { error: e instanceof Error ? e.message : String(e) };
  }

  let kieWatchdog: unknown = null;
  try {
    const { runGatewayKieWatchdog } = await import(
      "@/lib/gateway/gateway-kie-watchdog"
    );
    kieWatchdog = await runGatewayKieWatchdog({ source: "gateway-health-heal" });
  } catch (e) {
    kieWatchdog = { error: e instanceof Error ? e.message : String(e) };
  }

  let canvasRecovered = 0;
  try {
    const { recoverStalePreSubmitVideoTasks } = await import(
      "@/lib/generation/traffic-control/recover-stale-dispatching"
    );
    canvasRecovered = await recoverStalePreSubmitVideoTasks({ limit: 40 });
  } catch (e) {
    console.warn(
      "[gateway-health] canvas recover failed",
      e instanceof Error ? e.message : e,
    );
  }

  const statsReconciled = await reconcileStats();

  const heal: GatewayHealthHealReport = {
    staleChatClosed,
    expired,
    videoWatchdog,
    kieWatchdog,
    canvasRecovered,
    statsReconciled,
  };
  g().__gatewayHealthLastHeal = heal;
  g().__gatewayHealthLastHealAt = new Date().toISOString();

  const after = await scanGatewayHealth({
    source: `${opts?.source ?? "manual"}:post-heal`,
  });
  after.lastHeal = heal;
  after.lastHealAt = g().__gatewayHealthLastHealAt ?? null;

  if (after.opsHealth === "critical") {
    const msg = after.alerts
      .filter((a) => a.level === "CRITICAL")
      .map((a) => a.message)
      .join("；");
    recordPlatformError({
      source: "GATEWAY",
      severity: "ERROR",
      code: "GATEWAY_HEALTH_CRITICAL",
      message: msg || "Gateway 阻塞预警仍为需立即处理",
      context: {
        staleChat: after.counts.staleChat,
        videoHard: after.counts.videoHard,
        inflight: after.counts.inflight,
      },
    });
  }

  return { before, after, heal };
}
