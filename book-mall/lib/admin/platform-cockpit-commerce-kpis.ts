/**
 * 平台驾驶舱 · 当月订阅 / 充值（PaymentCheckout PAID）。
 */
import { prisma } from "@/lib/prisma";
import { currentPeriodKey, periodBounds } from "@/lib/finance/team-finance-guard";

export type CockpitCommerceMonthKpis = {
  periodKey: string;
  membership: {
    userCount: number;
    amountYuan: number;
    orderCount: number;
  };
  topup: {
    userCount: number;
    amountYuan: number;
    orderCount: number;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildCockpitCommerceMonthKpis(input?: {
  periodKey?: string;
  now?: Date;
}): Promise<CockpitCommerceMonthKpis> {
  const now = input?.now ?? new Date();
  const periodKey = input?.periodKey ?? currentPeriodKey(now);
  const { from, to } = periodBounds(periodKey);

  const paidInMonth = {
    status: "PAID" as const,
    paidAt: { gte: from, lt: to },
  };

  const [membershipRows, topupRows] = await Promise.all([
    prisma.paymentCheckout.findMany({
      where: {
        ...paidInMonth,
        productKind: { in: ["MEMBERSHIP_PERSONAL", "MEMBERSHIP_TEAM"] },
      },
      select: { userId: true, amountYuan: true },
    }),
    prisma.paymentCheckout.findMany({
      where: {
        ...paidInMonth,
        productKind: "CREDIT_TOPUP",
      },
      select: { userId: true, amountYuan: true },
    }),
  ]);

  function summarize(rows: Array<{ userId: string; amountYuan: unknown }>) {
    const users = new Set(rows.map((r) => r.userId));
    const amountYuan = rows.reduce((s, r) => s + Number(r.amountYuan), 0);
    return {
      userCount: users.size,
      amountYuan: round2(amountYuan),
      orderCount: rows.length,
    };
  }

  return {
    periodKey,
    membership: summarize(membershipRows),
    topup: summarize(topupRows),
  };
}
