/**
 * 平台驾驶舱 · 当日（CST）数据看板聚合。
 */
import {
  cockpitDailyAppLabel,
  resolveCockpitDailyAppKey,
  resolveCockpitDailyMediaKind,
  resolveCockpitDailyProjectKey,
  type CockpitDailyAppKey,
} from "@/lib/admin/platform-cockpit-daily-scope";
import { cstBusinessDate, cstDayStartUtc } from "@/lib/billing/credit-ops-service";
import { estimateGatewayLogNetCostYuan } from "@/lib/finance/gateway-log-line-cost";
import { GATEWAY_USAGE_LOG_SELECT } from "@/lib/gateway/gateway-token-usage-aggregate";
import { prisma } from "@/lib/prisma";

const PROJECT_TOP_N = 20;
const DETAIL_ROW_LIMIT = 100;
const COST_SCAN_CAP = 3000;

export type CockpitDailyAppRow = {
  appKey: CockpitDailyAppKey;
  appLabel: string;
  credits: number;
  imageCount: number;
  videoCount: number;
  otherCount: number;
  gatewaySucceeded: number;
  gatewayFailed: number;
  costYuan: number;
};

export type CockpitDailyProjectRow = {
  appKey: CockpitDailyAppKey;
  appLabel: string;
  projectKey: string;
  projectLabel: string;
  credits: number;
  imageCount: number;
  videoCount: number;
  gatewaySucceeded: number;
  costYuan: number;
};

export type CockpitDailyDetailRow = {
  id: string;
  submittedAt: string;
  appKey: CockpitDailyAppKey;
  appLabel: string;
  projectKey: string;
  projectLabel: string;
  model: string;
  requestKind: string;
  mediaKind: "image" | "video" | "other";
  credits: number;
  costYuan: number;
  actorBookUserId: string | null;
};

export type CockpitDailyDashboardSnapshot = {
  businessDateCst: string;
  generatedAt: string;
  overview: {
    creditsFromGateway: number;
    creditsFromLedger: number;
    imageSucceeded: number;
    videoSucceeded: number;
    gatewaySucceeded: number;
    gatewayFailed: number;
    gatewayRunning: number;
    costYuan: number;
    costScanCount: number;
    costTruncated: boolean;
    creditsDelta: number;
    creditsDeltaRate: number | null;
    creditReconcileAlert: boolean;
  };
  byApp: CockpitDailyAppRow[];
  byProject: CockpitDailyProjectRow[];
  details: CockpitDailyDetailRow[];
};

type Bucket = {
  credits: number;
  image: number;
  video: number;
  other: number;
  ok: number;
  fail: number;
  costYuan: number;
};

function emptyBucket(): Bucket {
  return { credits: 0, image: 0, video: 0, other: 0, ok: 0, fail: 0, costYuan: 0 };
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dayBounds(businessDateCst: string): { start: Date; end: Date } {
  const start = cstDayStartUtc(businessDateCst);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function buildCockpitDailyDashboard(input?: {
  businessDateCst?: string;
  now?: Date;
}): Promise<CockpitDailyDashboardSnapshot> {
  const now = input?.now ?? new Date();
  const businessDateCst = input?.businessDateCst ?? cstBusinessDate(now);
  const { start, end } = dayBounds(businessDateCst);

  const [ledgerAgg, statusGroups, logsForAgg, logsForCost, runningCount] =
    await Promise.all([
      prisma.creditLedger.aggregate({
        where: {
          type: { in: ["CONSUME", "SETTLE"] },
          createdAt: { gte: start, lt: end },
        },
        _sum: { credits: true },
      }),
      prisma.gatewayRequestLog.groupBy({
        by: ["status"],
        where: { submittedAt: { gte: start, lt: end } },
        _count: { _all: true },
      }),
      prisma.gatewayRequestLog.findMany({
        where: { submittedAt: { gte: start, lt: end } },
        select: {
          id: true,
          status: true,
          requestKind: true,
          clientSource: true,
          clientPage: true,
          storyProjectId: true,
          creditsCharged: true,
          submittedAt: true,
          model: true,
          actorBookUserId: true,
        },
        orderBy: { submittedAt: "desc" },
        take: 15000,
      }),
      prisma.gatewayRequestLog.findMany({
        where: {
          submittedAt: { gte: start, lt: end },
          status: "SUCCEEDED",
        },
        select: {
          ...GATEWAY_USAGE_LOG_SELECT,
          id: true,
          clientSource: true,
          storyProjectId: true,
          costSnapshotYuan: true,
          estimatedVendorCostYuan: true,
        },
        orderBy: { submittedAt: "desc" },
        take: COST_SCAN_CAP,
      }),
      prisma.gatewayRequestLog.count({
        where: {
          status: { in: ["PENDING", "RUNNING"] },
          submittedAt: { gte: start, lt: end },
        },
      }),
    ]);

  const creditsFromLedger = Math.abs(num(ledgerAgg._sum.credits));

  let gatewaySucceeded = 0;
  let gatewayFailed = 0;
  for (const g of statusGroups) {
    const c = g._count._all;
    if (g.status === "SUCCEEDED") gatewaySucceeded += c;
    else if (g.status === "FAILED") gatewayFailed += c;
  }

  const appMap = new Map<CockpitDailyAppKey, Bucket>();
  const projectMap = new Map<string, Bucket & { appKey: CockpitDailyAppKey; projectKey: string }>();

  let creditsFromGateway = 0;
  let imageSucceeded = 0;
  let videoSucceeded = 0;

  for (const log of logsForAgg) {
    const appKey = resolveCockpitDailyAppKey({
      clientSource: log.clientSource,
      clientPage: log.clientPage,
    });
    const projectKey = resolveCockpitDailyProjectKey({
      clientPage: log.clientPage,
      storyProjectId: log.storyProjectId,
      appKey,
    });
    const projCompound = `${appKey}\0${projectKey}`;

    if (!appMap.has(appKey)) appMap.set(appKey, emptyBucket());
    if (!projectMap.has(projCompound)) {
      projectMap.set(projCompound, {
        ...emptyBucket(),
        appKey,
        projectKey,
      });
    }
    const appB = appMap.get(appKey)!;
    const projB = projectMap.get(projCompound)!;

    const ok = log.status === "SUCCEEDED";
    const fail = log.status === "FAILED";
    if (ok) {
      appB.ok += 1;
      projB.ok += 1;
      const media = resolveCockpitDailyMediaKind(log.requestKind);
      if (media === "image") {
        appB.image += 1;
        projB.image += 1;
        imageSucceeded += 1;
      } else if (media === "video") {
        appB.video += 1;
        projB.video += 1;
        videoSucceeded += 1;
      } else {
        appB.other += 1;
        projB.other += 1;
      }
      const cr = num(log.creditsCharged);
      if (cr > 0) {
        appB.credits += cr;
        projB.credits += cr;
        creditsFromGateway += cr;
      }
    }
    if (fail) {
      appB.fail += 1;
      projB.fail += 1;
    }
  }

  const costByLogId = new Map<string, number>();
  let costYuan = 0;
  for (const log of logsForCost) {
    const lineCost = estimateGatewayLogNetCostYuan(log);
    costByLogId.set(log.id, lineCost);
    costYuan += lineCost;
    const appKey = resolveCockpitDailyAppKey({
      clientSource: log.clientSource,
      clientPage: log.clientPage,
    });
    const projectKey = resolveCockpitDailyProjectKey({
      clientPage: log.clientPage,
      storyProjectId: log.storyProjectId,
      appKey,
    });
    const projCompound = `${appKey}\0${projectKey}`;
    if (!appMap.has(appKey)) appMap.set(appKey, emptyBucket());
    appMap.get(appKey)!.costYuan += lineCost;
    if (!projectMap.has(projCompound)) {
      projectMap.set(projCompound, { ...emptyBucket(), appKey, projectKey });
    }
    projectMap.get(projCompound)!.costYuan += lineCost;
  }

  const canvasIds = [
    ...new Set(
      [...projectMap.values()]
        .filter((p) => p.appKey === "canvas" && p.projectKey !== "—")
        .map((p) => p.projectKey),
    ),
  ].slice(0, 200);

  const canvasNames = new Map<string, string>();
  if (canvasIds.length) {
    const rows = await prisma.canvasProject.findMany({
      where: { id: { in: canvasIds } },
      select: { id: true, name: true },
    });
    for (const r of rows) canvasNames.set(r.id, r.name);
  }

  function projectLabel(appKey: CockpitDailyAppKey, projectKey: string): string {
    if (appKey === "canvas" && canvasNames.has(projectKey)) {
      return canvasNames.get(projectKey)!;
    }
    return projectKey;
  }

  const byApp: CockpitDailyAppRow[] = [...appMap.entries()]
    .map(([appKey, b]) => ({
      appKey,
      appLabel: cockpitDailyAppLabel(appKey),
      credits: round2(b.credits),
      imageCount: b.image,
      videoCount: b.video,
      otherCount: b.other,
      gatewaySucceeded: b.ok,
      gatewayFailed: b.fail,
      costYuan: round2(b.costYuan),
    }))
    .sort((a, b) => b.gatewaySucceeded - a.gatewaySucceeded);

  const byProject: CockpitDailyProjectRow[] = [...projectMap.values()]
    .map((b) => ({
      appKey: b.appKey,
      appLabel: cockpitDailyAppLabel(b.appKey),
      projectKey: b.projectKey,
      projectLabel: projectLabel(b.appKey, b.projectKey),
      credits: round2(b.credits),
      imageCount: b.image,
      videoCount: b.video,
      gatewaySucceeded: b.ok,
      costYuan: round2(b.costYuan),
    }))
    .sort((a, b) => b.gatewaySucceeded - a.gatewaySucceeded)
    .slice(0, PROJECT_TOP_N);

  const succeededForDetail = logsForAgg
    .filter((l) => l.status === "SUCCEEDED")
    .slice(0, DETAIL_ROW_LIMIT);

  const details: CockpitDailyDetailRow[] = succeededForDetail.map((log) => {
    const appKey = resolveCockpitDailyAppKey({
      clientSource: log.clientSource,
      clientPage: log.clientPage,
    });
    const projectKey = resolveCockpitDailyProjectKey({
      clientPage: log.clientPage,
      storyProjectId: log.storyProjectId,
      appKey,
    });
    return {
      id: log.id,
      submittedAt: log.submittedAt.toISOString(),
      appKey,
      appLabel: cockpitDailyAppLabel(appKey),
      projectKey,
      projectLabel: projectLabel(appKey, projectKey),
      model: log.model,
      requestKind: log.requestKind,
      mediaKind: resolveCockpitDailyMediaKind(log.requestKind),
      credits: round2(num(log.creditsCharged)),
      costYuan: round2(costByLogId.get(log.id) ?? 0),
      actorBookUserId: log.actorBookUserId,
    };
  });

  const creditsFromGatewayR = round2(creditsFromGateway);
  const creditsFromLedgerR = round2(creditsFromLedger);
  const creditsDelta = round2(creditsFromGatewayR - creditsFromLedgerR);
  const creditBase = Math.max(creditsFromGatewayR, creditsFromLedgerR, 1);
  const creditsDeltaRate =
    creditsFromGatewayR > 0 || creditsFromLedgerR > 0
      ? round2(Math.abs(creditsDelta) / creditBase)
      : null;
  const creditReconcileAlert =
    Math.abs(creditsDelta) > 0.01 &&
    (Math.abs(creditsDelta) >= 10 || (creditsDeltaRate ?? 0) >= 0.05);

  return {
    businessDateCst,
    generatedAt: now.toISOString(),
    overview: {
      creditsFromGateway: creditsFromGatewayR,
      creditsFromLedger: creditsFromLedgerR,
      imageSucceeded,
      videoSucceeded,
      gatewaySucceeded,
      gatewayFailed,
      gatewayRunning: runningCount,
      costYuan: round2(costYuan),
      costScanCount: logsForCost.length,
      costTruncated: gatewaySucceeded > COST_SCAN_CAP,
      creditsDelta,
      creditsDeltaRate,
      creditReconcileAlert,
    },
    byApp,
    byProject,
    details,
  };
}
