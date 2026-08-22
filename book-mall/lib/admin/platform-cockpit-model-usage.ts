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

export async function buildCockpitModelUsageSnapshot(input?: {
  periodKey?: string;
  now?: Date;
}): Promise<CockpitModelUsageSnapshot> {
  const now = input?.now ?? new Date();
  const periodKey = input?.periodKey ?? currentPeriodKey(now);
  const { from, to } = periodBounds(periodKey);

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "SUCCEEDED",
      submittedAt: { gte: from, lt: to },
    },
    select: { requestKind: true, submittedAt: true },
  });

  const trendKeys = cstDatesInPeriodThroughToday(periodKey, now);
  const trendBuckets = new Map<string, CockpitModelUsageMonthTotals>(
    trendKeys.map((k) => [k, emptyTotals()]),
  );
  const monthTotals = emptyTotals();

  for (const log of logs) {
    const cat = classifyGatewayRequestKind(log.requestKind);
    monthTotals[cat] += 1;
    monthTotals.total += 1;

    const key = cstDateKeyFromUtc(log.submittedAt);
    const bucket = trendBuckets.get(key);
    if (!bucket) continue;
    bucket[cat] += 1;
    bucket.total += 1;
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
