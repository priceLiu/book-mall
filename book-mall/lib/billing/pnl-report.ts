/**
 * 简易 P&L 报表（营收拆分、分业务毛利）。
 */
import { estimateGatewayLogNetCostYuan } from "@/lib/finance/gateway-log-line-cost";
import { GATEWAY_USAGE_LOG_SELECT } from "@/lib/gateway/gateway-token-usage-aggregate";
import { prisma } from "@/lib/prisma";

export interface PnlReportRow {
  periodKey: string;
  revenueYuan: number;
  costYuan: number;
  marginRate: number;
  consumeCredits: number;
}

export async function buildPnlReport(periodKey: string): Promise<PnlReportRow> {
  const since = new Date(`${periodKey}-01T00:00:00.000Z`);
  const until = new Date(since);
  until.setMonth(until.getMonth() + 1);

  const ledgers = await prisma.creditLedger.findMany({
    where: {
      type: { in: ["SETTLE", "CONSUME"] },
      createdAt: { gte: since, lt: until },
    },
    select: {
      credits: true,
      costSnapshotYuan: true,
      refType: true,
      refId: true,
      account: { select: { pricePerCreditYuan: true } },
    },
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
            ...GATEWAY_USAGE_LOG_SELECT,
            costSnapshotYuan: true,
            estimatedVendorCostYuan: true,
          },
        })
      : [];
  const logCostMap = new Map(gatewayLogs.map((g) => [g.id, estimateGatewayLogNetCostYuan(g)]));

  let revenueYuan = 0;
  let costYuan = 0;
  let consumeCredits = 0;
  for (const l of ledgers) {
    const credits = Math.abs(l.credits);
    const ppc = l.account.pricePerCreditYuan != null ? Number(l.account.pricePerCreditYuan) : 0.04;
    revenueYuan += credits * ppc;
    if (l.refType === "gateway_log" && l.refId && logCostMap.has(l.refId)) {
      costYuan += logCostMap.get(l.refId) ?? 0;
    } else {
      costYuan += l.costSnapshotYuan != null ? Number(l.costSnapshotYuan) : 0;
    }
    consumeCredits += credits;
  }

  return {
    periodKey,
    revenueYuan: Math.round(revenueYuan * 100) / 100,
    costYuan: Math.round(costYuan * 100) / 100,
    marginRate: revenueYuan > 0 ? Math.round((1 - costYuan / revenueYuan) * 10000) / 10000 : 0,
    consumeCredits,
  };
}
