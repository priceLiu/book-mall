import type { MembershipInterval } from "@prisma/client";

import { resolvePlanCreditGrants } from "@/lib/billing/plan-credit-grants";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import { membershipServicePeriodStart } from "@/lib/billing/membership-service-period";
import { prisma } from "@/lib/prisma";

export type TenantPackageSnapshot = {
  /** 当前账期套餐发放额（通用池 + 视频池） */
  packageTotalCredits: number | null;
  /** 通用池月发放额 */
  generalGrantCredits: number;
  /** 视频池月发放额 */
  videoGrantCredits: number;
  /** 当前套餐应付总额（元） */
  packageTotalPriceYuan: number | null;
  packageInterval: MembershipInterval | null;
  packageIntervalLabel: string;
  /** 当前账期起始日（由 currentPeriodEnd 反推；无则回退租户创建日） */
  periodStartAt: string;
  /** 当前账期到期日（续费后顺延） */
  periodEndAt: string | null;
  /**
   * 续期次数：含首期 = 1；每完成一次 monthly_grant 账期重置 +1。
   * 便于识别「第 N 个计费周期」。
   */
  renewalCount: number;
  /** 团队共享池剩余（通用池 + 视频池可用余额） */
  remainingCredits: number;
  /** @deprecated 使用 remainingCredits；保留供旧客户端过渡 */
  monthlyGrantCredits: number;
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

/** 续期次数：首期 1 + 已执行的 monthly_grant 周期数。 */
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
    if (periodKey && periodKey !== "video") periods.add(periodKey);
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
        videoBalanceCredits: true,
        videoMonthlyGrant: true,
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
            videoMonthlyCredits: true,
          },
        })
      : Promise.resolve(null),
  ]);
  const renewalCount = await countTenantRenewalPeriods(account?.id);

  const interval = tenant.interval ?? plan?.interval ?? null;
  const periodEnd = tenant.currentPeriodEnd ?? account?.currentPeriodEnd ?? null;
  const periodStart =
    computePeriodStart(periodEnd, interval) ?? tenant.createdAt;

  let packageTotalPriceYuan: number | null = plan ? num(plan.priceYuan) : null;

  let generalGrantCredits = account?.monthlyGrantCredits ?? 0;
  let videoGrantCredits = account?.videoMonthlyGrant ?? 0;

  if (tenant.planId) {
    try {
      const quote = await quoteTeamPlan({
        planId: tenant.planId,
        totalSeats: tenant.seatLimit,
      });
      packageTotalPriceYuan = quote.totalPriceYuan;
      if (!account) {
        const grants = resolvePlanCreditGrants(plan!, tenant.seatLimit);
        generalGrantCredits = grants.monthlyGrantCredits;
        videoGrantCredits = grants.videoMonthlyGrantCredits;
      }
    } catch {
      /* 套餐缺失时保留 account / plan 快照 */
    }
  } else if (plan && !account) {
    const grants = resolvePlanCreditGrants(plan, tenant.seatLimit);
    generalGrantCredits = grants.monthlyGrantCredits;
    videoGrantCredits = grants.videoMonthlyGrantCredits;
  }

  const packageTotalCredits =
    generalGrantCredits > 0 || videoGrantCredits > 0
      ? generalGrantCredits + videoGrantCredits
      : null;

  const remainingCredits =
    (account?.balanceCredits ?? 0) + (account?.videoBalanceCredits ?? 0);

  return {
    packageTotalCredits,
    generalGrantCredits,
    videoGrantCredits,
    packageTotalPriceYuan,
    packageInterval: interval,
    packageIntervalLabel: intervalLabel(interval),
    periodStartAt: periodStart.toISOString(),
    periodEndAt: periodEnd?.toISOString() ?? null,
    renewalCount,
    remainingCredits,
    monthlyGrantCredits: generalGrantCredits,
  };
}
