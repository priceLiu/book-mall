/**
 * 平台驾驶舱 · Gateway 成功调用按 requestKind 归类（图片 / 视频 / 其他）。
 */
import { prisma } from "@/lib/prisma";
import { cstBusinessDate, cstDayStartUtc } from "@/lib/billing/credit-ops-service";
import { currentPeriodKey, periodBounds } from "@/lib/finance/team-finance-guard";

export type CockpitModelUsageCategory = "image" | "video" | "other";

export type CockpitModelUsageMonthTotals = {
  image: number;
  video: number;
  other: number;
  total: number;
};

export type CockpitModelUsageTrendDatum = {
  date: string;
  image: number;
  video: number;
  other: number;
  total: number;
};

export type CockpitModelUsageSnapshot = {
  periodKey: string;
  monthTotals: CockpitModelUsageMonthTotals;
  trend: CockpitModelUsageTrendDatum[];
};

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

function cstDateKeyFromUtc(d: Date): string {
  const cst = new Date(d.getTime() + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

export function classifyGatewayRequestKind(
  requestKind: string,
): CockpitModelUsageCategory {
  if (requestKind === "IMAGE" || requestKind === "TRYON") return "image";
  if (requestKind === "VIDEO") return "video";
  return "other";
}

function emptyTotals(): CockpitModelUsageMonthTotals {
  return { image: 0, video: 0, other: 0, total: 0 };
}

/** 当月 CST 业务日列表（1 日至今） */
function cstDatesInPeriodThroughToday(periodKey: string, now: Date): string[] {
  const { from } = periodBounds(periodKey);
  const today = cstBusinessDate(now);
  const keys: string[] = [];
  let cursor = cstDateKeyFromUtc(from);
  while (cursor <= today) {
    keys.push(cursor);
    const start = cstDayStartUtc(cursor);
    cursor = cstDateKeyFromUtc(new Date(start.getTime() + 24 * 60 * 60 * 1000));
  }
  return keys;
}

type GatewayUsageDailyAggRow = {
  date_cst: string;
  requestKind: string;
  cnt: bigint;
};

export async function buildCockpitModelUsageSnapshot(input?: {
  periodKey?: string;
  now?: Date;
}): Promise<CockpitModelUsageSnapshot> {
  const now = input?.now ?? new Date();
  const periodKey = input?.periodKey ?? currentPeriodKey(now);
  const { from, to } = periodBounds(periodKey);

  const [monthGroups, dailyRows] = await Promise.all([
    prisma.gatewayRequestLog.groupBy({
      by: ["requestKind"],
      where: {
        status: "SUCCEEDED",
        submittedAt: { gte: from, lt: to },
      },
      _count: { _all: true },
    }),
    prisma.$queryRaw<GatewayUsageDailyAggRow[]>`
      SELECT
        to_char(("submittedAt" AT TIME ZONE 'UTC' + interval '8 hours'), 'YYYY-MM-DD') AS date_cst,
        "requestKind"::text AS "requestKind",
        COUNT(*)::bigint AS cnt
      FROM "GatewayRequestLog"
      WHERE status = 'SUCCEEDED'::"GatewayRequestStatus"
        AND "submittedAt" >= ${from}
        AND "submittedAt" < ${to}
      GROUP BY 1, 2
    `,
  ]);

  const trendKeys = cstDatesInPeriodThroughToday(periodKey, now);
  const trendBuckets = new Map<string, CockpitModelUsageMonthTotals>(
    trendKeys.map((k) => [k, emptyTotals()]),
  );
  const monthTotals = emptyTotals();

  for (const row of monthGroups) {
    const cat = classifyGatewayRequestKind(row.requestKind);
    const n = row._count._all;
    monthTotals[cat] += n;
    monthTotals.total += n;
  }

  for (const row of dailyRows) {
    const bucket = trendBuckets.get(row.date_cst);
    if (!bucket) continue;
    const n = Number(row.cnt);
    const cat = classifyGatewayRequestKind(row.requestKind);
    bucket[cat] += n;
    bucket.total += n;
  }

  return {
    periodKey,
    monthTotals,
    trend: trendKeys.map((date) => {
      const b = trendBuckets.get(date) ?? emptyTotals();
      return { date, ...b };
    }),
  };
}
