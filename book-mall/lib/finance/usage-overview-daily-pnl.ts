/**
 * 费用概览 · 按日 P&L（与 buildPnlReport / CreditLedger 同源，AR-103）。
 */
import { estimateGatewayLogNetCostYuan } from "@/lib/finance/gateway-log-line-cost";
import { GATEWAY_USAGE_LOG_SELECT } from "@/lib/gateway/gateway-token-usage-aggregate";
import { prisma } from "@/lib/prisma";

export type DailyPnlRow = {
  day: string;
  revenueYuan: number;
  costYuan: number;
  profitYuan: number;
  marginRate: number | null;
  consumeCredits: number;
  callCount: number;
};

function shanghaiDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
}

function monthStartUtc(yyyymm: string): Date {
  return new Date(
    Date.UTC(parseInt(yyyymm.slice(0, 4), 10), parseInt(yyyymm.slice(4), 10) - 1, 1),
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildUsageOverviewDailyPnl(input: {
  sinceMonth: string;
  userId?: string;
  billingPersona?: string;
  staffFlag?: string;
}): Promise<DailyPnlRow[]> {
  const sinceMonth = /^\d{6}$/.test(input.sinceMonth.trim())
    ? input.sinceMonth.trim()
    : `${new Date().getUTCFullYear()}${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
  const since = monthStartUtc(sinceMonth);
  const until = new Date();

  const ledgerWhere: {
    type: { in: ["SETTLE", "CONSUME"] };
    createdAt: { gte: Date; lt: Date };
    account?: { ownerType: "USER"; ownerId: string };
    billingPersonaSnap?: "PLATFORM_CREDIT";
    staffFlag?: boolean;
  } = {
    type: { in: ["SETTLE", "CONSUME"] },
    createdAt: { gte: since, lt: until },
  };

  if (input.userId?.trim()) {
    ledgerWhere.account = { ownerType: "USER", ownerId: input.userId.trim() };
  }
  if (input.billingPersona?.trim() === "PLATFORM_CREDIT") {
    ledgerWhere.billingPersonaSnap = "PLATFORM_CREDIT";
  }
  if (input.staffFlag === "1") ledgerWhere.staffFlag = true;
  if (input.staffFlag === "0") ledgerWhere.staffFlag = false;

  const ledgers = await prisma.creditLedger.findMany({
    where: ledgerWhere,
    select: {
      credits: true,
      costSnapshotYuan: true,
      refType: true,
      refId: true,
      createdAt: true,
      account: { select: { pricePerCreditYuan: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const logIds = [
    ...new Set(
      ledgers
        .filter((l) => l.refType === "gateway_log" && l.refId)
        .map((l) => l.refId as string),
    ),
  ];
  const gatewayLogs =
    logIds.length > 0
      ? await prisma.gatewayRequestLog.findMany({
          where: { id: { in: logIds } },
          select: {
            id: true,
            ...GATEWAY_USAGE_LOG_SELECT,
            costSnapshotYuan: true,
            estimatedVendorCostYuan: true,
          },
        })
      : [];
  const logCostMap = new Map(gatewayLogs.map((g) => [g.id, estimateGatewayLogNetCostYuan(g)]));

  const dayMap = new Map<
    string,
    { revenue: number; cost: number; credits: number; calls: Set<string> }
  >();

  for (const l of ledgers) {
    const credits = Math.abs(l.credits);
    if (credits <= 0) continue;
    const day = shanghaiDayKey(l.createdAt);
    const bucket = dayMap.get(day) ?? {
      revenue: 0,
      cost: 0,
      credits: 0,
      calls: new Set<string>(),
    };
    const ppc =
      l.account.pricePerCreditYuan != null ? Number(l.account.pricePerCreditYuan) : 0.04;
    bucket.revenue += credits * ppc;
    if (l.refType === "gateway_log" && l.refId && logCostMap.has(l.refId)) {
      bucket.cost += logCostMap.get(l.refId) ?? 0;
      bucket.calls.add(l.refId);
    } else {
      bucket.cost += l.costSnapshotYuan != null ? Number(l.costSnapshotYuan) : 0;
    }
    bucket.credits += credits;
    dayMap.set(day, bucket);
  }

  return [...dayMap.entries()]
    .map(([day, b]) => {
      const revenueYuan = round2(b.revenue);
      const costYuan = round2(b.cost);
      const profitYuan = round2(revenueYuan - costYuan);
      return {
        day,
        revenueYuan,
        costYuan,
        profitYuan,
        marginRate: revenueYuan > 0 ? round2(profitYuan / revenueYuan) : null,
        consumeCredits: b.credits,
        callCount: b.calls.size,
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day));
}
