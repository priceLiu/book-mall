import type { MembershipInterval } from "@prisma/client";

import { resolvePlanCreditGrants } from "@/lib/billing/plan-credit-grants";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { membershipServicePeriodStart } from "@/lib/billing/membership-service-period";
import { prisma } from "@/lib/prisma";

export type TenantPackageSnapshot = {
  packageTotalCredits: number | null;
  monthlyGrantCredits: number;
  packageTotalPriceYuan: number | null;
  packageInterval: MembershipInterval | null;
  packageIntervalLabel: string;
  periodStartAt: string;
  periodEndAt: string | null;
  renewalCount: number;
  remainingCredits: number;
};

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function intervalLabel(interval: MembershipInterval | null | undefined): string {
  if (interval === "YEAR") return "年付";
  if (interval === "MONTH") return "月付";
  return "—";
}

function computePeriodStart(
  periodEnd: Date | null | undefined,
  interval: MembershipInterval | null | undefined,
): Date | null {
  if (!periodEnd || !interval) return null;
  return membershipServicePeriodStart(periodEnd, interval);
}

async function countTenantRenewalPeriods(accountId: string | null | undefined): Promise<number> {
  if (!accountId) return 1;
  const rows = await prisma.creditLedger.findMany({
    where: {
      accountId,
      refType: "monthly_grant",
      idempotencyKey: { startsWith: "monthly_grant:" },
    },
    select: { idempotencyKey: true },
  });
  const periods = new Set<string>();
  for (const row of rows) {
    const parts = row.idempotencyKey?.split(":") ?? [];
    const periodKey = parts[2];
    if (periodKey) periods.add(periodKey);
  }
  return 1 + periods.size;
}

/** 团队套餐快照：列表 / 详情共用。 */
export async function resolveTenantPackageSnapshot(tenant: {
  id: string;
  planId: string | null;
  seatLimit: number;
  interval: MembershipInterval | null;
  createdAt: Date;
  currentPeriodEnd: Date | null;
}): Promise<TenantPackageSnapshot> {
  const [account, plan] = await Promise.all([
    prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: tenant.id } },
      select: {
        id: true,
        balanceCredits: true,
        monthlyGrantCredits: true,
        currentPeriodEnd: true,
      },
    }),
    tenant.planId
      ? prisma.membershipPlan.findUnique({
          where: { id: tenant.planId },
          select: {
            interval: true,
            priceYuan: true,
            family: true,
            monthlyCredits: true,
          },
        })
      : Promise.resolve(null),
  ]);
  const renewalCount = await countTenantRenewalPeriods(account?.id);

  const interval = tenant.interval ?? plan?.interval ?? null;
  const periodEnd = tenant.currentPeriodEnd ?? account?.currentPeriodEnd ?? null;
  const periodStart = computePeriodStart(periodEnd, interval) ?? tenant.createdAt;

  let packageTotalPriceYuan: number | null = plan ? num(plan.priceYuan) : null;
  let monthlyGrantCredits = account?.monthlyGrantCredits ?? 0;

  if (tenant.planId) {
    try {
      const quote = await quoteTeamPlan({
        planId: tenant.planId,
        totalSeats: tenant.seatLimit,
      });
      packageTotalPriceYuan = quote.totalPriceYuan;
      if (!account) {
        const grants = resolvePlanCreditGrants(plan!, tenant.seatLimit);
        monthlyGrantCredits = grants.monthlyGrantCredits;
      }
    } catch {
      /* 套餐缺失时保留 account / plan 快照 */
    }
  } else if (plan && !account) {
    const grants = resolvePlanCreditGrants(plan, tenant.seatLimit);
    monthlyGrantCredits = grants.monthlyGrantCredits;
  }

  const packageTotalCredits = monthlyGrantCredits > 0 ? monthlyGrantCredits : null;
  const remainingCredits = account?.balanceCredits ?? 0;

  return {
    packageTotalCredits,
    monthlyGrantCredits,
    packageTotalPriceYuan,
    packageInterval: interval,
    packageIntervalLabel: intervalLabel(interval),
    periodStartAt: periodStart.toISOString(),
    periodEndAt: periodEnd?.toISOString() ?? null,
    renewalCount,
    remainingCredits,
  };
}
