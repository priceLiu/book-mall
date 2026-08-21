import { prisma } from "@/lib/prisma";
import {
  PLATFORM_TRAFFIC_APP_KEYS,
  PLATFORM_TRAFFIC_APP_LABELS,
  type PlatformTrafficAppKey,
} from "@/lib/site-traffic/app-keys";
import { cstDateKey, lastNCstDateKeys } from "@/lib/site-traffic/cst-date";

export type TrafficTrendDatum = { date: string; pv: number; uv: number };

export type TrafficAppBreakdown = {
  appKey: PlatformTrafficAppKey;
  label: string;
  pageViews: number;
  uniqueIps: number;
};

export type TrafficIpRow = {
  ip: string;
  appKey: string;
  hitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  userId: string | null;
};

export type TrafficDashboardSnapshot = {
  generatedAt: string;
  selectedDateCst: string;
  compareDateCst: string;
  totals: {
    pageViews: number;
    uniqueIps: number;
    pageViewsCompare: number;
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
    uniqueIps,
    pageViewsCompare,
    uniqueIpsCompare,
    dailyRows,
    ipCountsByApp,
    trendDates,
  ] = await Promise.all([
    sumPvForDate(selectedDateCst, filterApp),
    countUvForDate(selectedDateCst, filterApp),
    sumPvForDate(compareDateCst, filterApp),
    countUvForDate(compareDateCst, filterApp),
    prisma.siteTrafficDaily.findMany({
      where: { dateCst: selectedDateCst },
      select: { appKey: true, pageViews: true },
    }),
    prisma.siteTrafficIpDaily.groupBy({
      by: ["appKey"],
      where: { dateCst: selectedDateCst },
      _count: { ip: true },
    }),
    Promise.resolve(lastNCstDateKeys(TREND_DAYS, now)),
  ]);

  const pvByApp = new Map(dailyRows.map((r) => [r.appKey, r.pageViews]));
  const uvByApp = new Map(ipCountsByApp.map((r) => [r.appKey, r._count.ip]));

  const byApp: TrafficAppBreakdown[] = PLATFORM_TRAFFIC_APP_KEYS.map((appKey) => ({
    appKey,
    label: PLATFORM_TRAFFIC_APP_LABELS[appKey],
    pageViews: pvByApp.get(appKey) ?? 0,
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
      firstSeenAt: true,
      lastSeenAt: true,
      userId: true,
      appKey: true,
    },
  });

  return {
    generatedAt: now.toISOString(),
    selectedDateCst,
    compareDateCst,
    totals: {
      pageViews,
      uniqueIps,
      pageViewsCompare,
      uniqueIpsCompare,
    },
    byApp,
    trend,
    topIps: topIpRows.map((r) => ({
      ip: r.ip,
      appKey: r.appKey,
      hitCount: r.hitCount,
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      userId: r.userId,
    })),
  };
}

export async function getTodayTrafficTotals(now: Date = new Date()): Promise<{
  pageViews: number;
  uniqueIps: number;
}> {
  const dateCst = cstDateKey(now);
  const [pageViews, uniqueIps] = await Promise.all([
    sumPvForDate(dateCst),
    countUvForDate(dateCst),
  ]);
  return { pageViews, uniqueIps };
}
