/**
 * 简易 P&L 报表（营收拆分、分业务毛利）。
 */
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
      account: { select: { pricePerCreditYuan: true } },
    },
  });

  let revenueYuan = 0;
  let costYuan = 0;
  let consumeCredits = 0;
  for (const l of ledgers) {
    const credits = Math.abs(l.credits);
    const ppc = l.account.pricePerCreditYuan != null ? Number(l.account.pricePerCreditYuan) : 0.04;
    revenueYuan += credits * ppc;
    costYuan += l.costSnapshotYuan != null ? Number(l.costSnapshotYuan) : 0;
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
