import { prisma } from "@/lib/prisma";
import { cstBusinessDate, cstDayStartUtc } from "@/lib/billing/credit-ops-service";
import {
  PLATFORM_TRAFFIC_APP_KEYS,
  PLATFORM_TRAFFIC_APP_LABELS,
  type PlatformTrafficAppKey,
} from "@/lib/site-traffic/app-keys";
import { cstDateKey, lastNCstDateKeys } from "@/lib/site-traffic/cst-date";
import { trafficHitKind, type TrafficHitKind } from "@/lib/platform-traffic/classify-traffic-path";
import { mapIpLocations } from "@/lib/site-traffic/ip-location";

const TODAY_REGISTERED_TRAFFIC_LIMIT = 200;

async function mapUserPhonesById(userIds: Array<string | null | undefined>): Promise<Map<string, string | null>> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, phone: true },
  });
  return new Map(users.map((u) => [u.id, u.phone]));
}

function cstDayBounds(now: Date): { start: Date; end: Date } {
  const businessDate = cstBusinessDate(now);
  const start = cstDayStartUtc(businessDate);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export type TrafficTrendDatum = { date: string; pv: number; uv: number };

export type TrafficAppBreakdown = {
  appKey: PlatformTrafficAppKey;
  label: string;
  pageViews: number;
  probeViews: number;
  uniqueIps: number;
};

export type TrafficIpKind = TrafficHitKind;

export type TrafficIpRow = {
  ip: string;
  appKey: string;
  hitCount: number;
  probeHitCount: number;
  kind: TrafficIpKind;
  firstSeenAt: string;
  lastSeenAt: string;
  userId: string | null;
  userPhone: string | null;
  ipLocation: string;
};

export type TodayRegisteredUserTrafficRow = {
  userId: string;
  phone: string | null;
  registeredAt: string;
  hitCount: number;
  probeHitCount: number;
  lastSeenAt: string | null;
};

export type TodayRegisteredUserTrafficSnapshot = {
  registeredCount: number;
  visitedCount: number;
  rows: TodayRegisteredUserTrafficRow[];
};

export type TrafficDashboardSnapshot = {
  generatedAt: string;
  selectedDateCst: string;
  compareDateCst: string;
  totals: {
    pageViews: number;
    probeViews: number;
    uniqueIps: number;
    pageViewsCompare: number;
    probeViewsCompare: number;
    uniqueIpsCompare: number;
  };
  byApp: TrafficAppBreakdown[];
  trend: TrafficTrendDatum[];
  topIps: TrafficIpRow[];
};

const TREND_DAYS = 14;
const TOP_IP_LIMIT = 50;

async function sumPvForDate(dateCst: string, appKey?: PlatformTrafficAppKey): Promise<number> {
  if (appKey) {
    const row = await prisma.siteTrafficDaily.findUnique({
      where: { dateCst_appKey: { dateCst, appKey } },
      select: { pageViews: true },
    });
    return row?.pageViews ?? 0;
  }
  const agg = await prisma.siteTrafficDaily.aggregate({
    where: { dateCst },
    _sum: { pageViews: true },
  });
  return agg._sum.pageViews ?? 0;
}

async function sumProbeForDate(dateCst: string, appKey?: PlatformTrafficAppKey): Promise<number> {
  if (appKey) {
    const row = await prisma.siteTrafficDaily.findUnique({
      where: { dateCst_appKey: { dateCst, appKey } },
      select: { probeViews: true },
    });
    return row?.probeViews ?? 0;
  }
  const agg = await prisma.siteTrafficDaily.aggregate({
    where: { dateCst },
    _sum: { probeViews: true },
  });
  return agg._sum.probeViews ?? 0;
}

async function countUvForDate(dateCst: string, appKey?: PlatformTrafficAppKey): Promise<number> {
  return prisma.siteTrafficIpDaily.count({
    where: { dateCst, ...(appKey ? { appKey } : {}) },
  });
}

export async function getTrafficDashboardSnapshot(opts: {
  dateCst?: string;
  appKey?: PlatformTrafficAppKey | "all";
  now?: Date;
}): Promise<TrafficDashboardSnapshot> {
  const now = opts.now ?? new Date();
  const selectedDateCst = opts.dateCst ?? cstDateKey(now);
  const compareDateCst = cstDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const filterApp = opts.appKey && opts.appKey !== "all" ? opts.appKey : undefined;

  const [
    pageViews,
    probeViews,
    uniqueIps,
    pageViewsCompare,
    probeViewsCompare,
    uniqueIpsCompare,
    dailyRows,
    ipCountsByApp,
    trendDates,
  ] = await Promise.all([
    sumPvForDate(selectedDateCst, filterApp),
    sumProbeForDate(selectedDateCst, filterApp),
    countUvForDate(selectedDateCst, filterApp),
    sumPvForDate(compareDateCst, filterApp),
    sumProbeForDate(compareDateCst, filterApp),
    countUvForDate(compareDateCst, filterApp),
    prisma.siteTrafficDaily.findMany({
      where: { dateCst: selectedDateCst },
      select: { appKey: true, pageViews: true, probeViews: true },
    }),
    prisma.siteTrafficIpDaily.groupBy({
      by: ["appKey"],
      where: { dateCst: selectedDateCst },
      _count: { ip: true },
    }),
    Promise.resolve(lastNCstDateKeys(TREND_DAYS, now)),
  ]);

  const pvByApp = new Map(dailyRows.map((r) => [r.appKey, r.pageViews]));
  const probeByApp = new Map(dailyRows.map((r) => [r.appKey, r.probeViews]));
  const uvByApp = new Map(ipCountsByApp.map((r) => [r.appKey, r._count.ip]));

  const byApp: TrafficAppBreakdown[] = PLATFORM_TRAFFIC_APP_KEYS.map((appKey) => ({
    appKey,
    label: PLATFORM_TRAFFIC_APP_LABELS[appKey],
    pageViews: pvByApp.get(appKey) ?? 0,
    probeViews: probeByApp.get(appKey) ?? 0,
    uniqueIps: uvByApp.get(appKey) ?? 0,
  })).filter((r) => r.pageViews > 0 || r.uniqueIps > 0);

  const trendDaily = await prisma.siteTrafficDaily.findMany({
    where: {
      dateCst: { in: trendDates },
      ...(filterApp ? { appKey: filterApp } : {}),
    },
    select: { dateCst: true, pageViews: true },
  });
  const trendUv = filterApp
    ? null
    : await prisma.siteTrafficIpDaily.groupBy({
        by: ["dateCst"],
        where: { dateCst: { in: trendDates } },
        _count: { ip: true },
      });

  const pvByDate = new Map<string, number>();
  for (const row of trendDaily) {
    pvByDate.set(row.dateCst, (pvByDate.get(row.dateCst) ?? 0) + row.pageViews);
  }
  const uvByDate = new Map(trendUv?.map((r) => [r.dateCst, r._count.ip]) ?? []);

  const trend: TrafficTrendDatum[] = trendDates.map((date) => ({
    date,
    pv: pvByDate.get(date) ?? 0,
    uv: filterApp
      ? 0 // filled below when single app
      : (uvByDate.get(date) ?? 0),
  }));

  if (filterApp) {
    const uvRows = await prisma.siteTrafficIpDaily.groupBy({
      by: ["dateCst"],
      where: { dateCst: { in: trendDates }, appKey: filterApp },
      _count: { ip: true },
    });
    const uvMap = new Map(uvRows.map((r) => [r.dateCst, r._count.ip]));
    for (const t of trend) {
      t.uv = uvMap.get(t.date) ?? 0;
    }
  }

  const topIpRows = await prisma.siteTrafficIpDaily.findMany({
    where: {
      dateCst: selectedDateCst,
      ...(filterApp ? { appKey: filterApp } : {}),
    },
    orderBy: { hitCount: "desc" },
    take: TOP_IP_LIMIT,
    select: {
      ip: true,
      hitCount: true,
      probeHitCount: true,
      firstSeenAt: true,
      lastSeenAt: true,
      userId: true,
      appKey: true,
    },
  });

  const phoneByUserId = await mapUserPhonesById(topIpRows.map((r) => r.userId));
  const locationByIp = mapIpLocations(topIpRows.map((r) => r.ip));

  return {
    generatedAt: now.toISOString(),
    selectedDateCst,
    compareDateCst,
    totals: {
      pageViews,
      probeViews,
      uniqueIps,
      pageViewsCompare,
      probeViewsCompare,
      uniqueIpsCompare,
    },
    byApp,
    trend,
    topIps: topIpRows.map((r) => ({
      ip: r.ip,
      appKey: r.appKey,
      hitCount: r.hitCount,
      probeHitCount: r.probeHitCount,
      kind: trafficHitKind(r.hitCount, r.probeHitCount),
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      userId: r.userId,
      userPhone: r.userId ? (phoneByUserId.get(r.userId) ?? null) : null,
      ipLocation: locationByIp.get(r.ip) ?? "—",
    })),
  };
}

/** 当日（CST）注册用户在本业务日的访问汇总（按 userId 聚合各 IP 行） */
export async function getTodayRegisteredUserTraffic(
  now: Date = new Date(),
): Promise<TodayRegisteredUserTrafficSnapshot> {
  const { start, end } = cstDayBounds(now);
  const dateCst = cstDateKey(now);

  const newUsers = await prisma.user.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { id: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: TODAY_REGISTERED_TRAFFIC_LIMIT,
  });

  if (newUsers.length === 0) {
    return { registeredCount: 0, visitedCount: 0, rows: [] };
  }

  const ids = newUsers.map((u) => u.id);
  const trafficGroups = await prisma.siteTrafficIpDaily.groupBy({
    by: ["userId"],
    where: { dateCst, userId: { in: ids } },
    _sum: { hitCount: true, probeHitCount: true },
    _max: { lastSeenAt: true },
  });

  const trafficByUserId = new Map(
    trafficGroups
      .filter((g): g is typeof g & { userId: string } => g.userId != null)
      .map((g) => [g.userId, g]),
  );

  const rows: TodayRegisteredUserTrafficRow[] = newUsers.map((u) => {
    const t = trafficByUserId.get(u.id);
    return {
      userId: u.id,
      phone: u.phone,
      registeredAt: u.createdAt.toISOString(),
      hitCount: t?._sum.hitCount ?? 0,
      probeHitCount: t?._sum.probeHitCount ?? 0,
      lastSeenAt: t?._max.lastSeenAt?.toISOString() ?? null,
    };
  });

  const visitedCount = rows.filter((r) => r.hitCount > 0 || r.probeHitCount > 0).length;

  return { registeredCount: newUsers.length, visitedCount, rows };
}

export async function getTodayTrafficTotals(now: Date = new Date()): Promise<{
  pageViews: number;
  probeViews: number;
  uniqueIps: number;
}> {
  const dateCst = cstDateKey(now);
  const [pageViews, probeViews, uniqueIps] = await Promise.all([
    sumPvForDate(dateCst),
    sumProbeForDate(dateCst),
    countUvForDate(dateCst),
  ]);
  return { pageViews, probeViews, uniqueIps };
}
