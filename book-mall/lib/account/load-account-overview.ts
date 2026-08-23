import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getMembershipFlags } from "@/lib/membership";
import { getMembershipToolAccess } from "@/lib/membership-tool-access";
import { getAccountCreditBalances, getLotBreakdown } from "@/lib/billing/credit-account-service";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import {
  getAccountPlatformCategoryUsageRows,
  getAccountUsageSummary,
} from "@/lib/finance/account-usage-summary";
import { prisma } from "@/lib/prisma";
import { getActiveTenantContext } from "@/lib/tenant/context";
import type { BillingPersona } from "@prisma/client";

export type AccountOverviewData = {
  billingPersona: BillingPersona | null;
  flags: Awaited<ReturnType<typeof getMembershipFlags>>;
  memberAccess: Awaited<ReturnType<typeof getMembershipToolAccess>>;
  creditBalances: Awaited<ReturnType<typeof getAccountCreditBalances>>;
  usageSummary: Awaited<ReturnType<typeof getAccountUsageSummary>>;
  packageUsageRows: Awaited<ReturnType<typeof getAccountPlatformCategoryUsageRows>>;
  lotBreakdown: Awaited<ReturnType<typeof getLotBreakdown>>;
  membershipPeriodEnd: Date | null;
  planPriceLabel: string | null;
  isTeamSharedPool: boolean;
};

/** 个人中心概览 · 聚合查询（供 API 与脚本复用）。 */
export async function loadAccountOverview(userId: string): Promise<AccountOverviewData> {
  const billingPersona = await getUserBillingPersona(userId);
  const activeCtx = await getActiveTenantContext(userId);

  const [flags, memberAccess] = await Promise.all([
    getMembershipFlags(userId),
    getMembershipToolAccess(userId),
  ]);

  let teamBillingRef: { ownerType: "TENANT"; ownerId: string } | null =
    billingPersona === "PLATFORM_CREDIT" && activeCtx?.tenantType === "TEAM"
      ? { ownerType: "TENANT", ownerId: activeCtx.tenantId }
      : null;

  if (
    !teamBillingRef &&
    billingPersona === "PLATFORM_CREDIT" &&
    memberAccess.source === "team_plan"
  ) {
    const teamMember = await prisma.tenantMember.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        tenant: { type: "TEAM", status: "ACTIVE", planId: { not: null } },
      },
      orderBy: { joinedAt: "asc" },
      select: { tenantId: true },
    });
    if (teamMember) {
      teamBillingRef = { ownerType: "TENANT", ownerId: teamMember.tenantId };
    }
  }

  const billingRef = teamBillingRef ?? {
    ownerType: "USER" as const,
    ownerId: userId,
  };

  const [creditBalances, creditAcc, usageSummary, teamTenant, lotBreakdown, packageUsageRows] =
    await Promise.all([
      getAccountCreditBalances(billingRef),
      prisma.creditAccount.findUnique({
        where: { ownerType_ownerId: billingRef },
        select: {
          currentPeriodEnd: true,
          membershipPaidUntil: true,
          planId: true,
          monthlyGrantCredits: true,
        },
      }),
      getAccountUsageSummary(userId, teamBillingRef ?? undefined),
      teamBillingRef
        ? prisma.tenant.findUnique({
            where: { id: teamBillingRef.ownerId },
            select: {
              planId: true,
              seatLimit: true,
              interval: true,
              currentPeriodEnd: true,
            },
          })
        : Promise.resolve(null),
      getLotBreakdown(billingRef),
      billingPersona === "BYOK" || billingPersona === "PLATFORM_CREDIT"
        ? getAccountPlatformCategoryUsageRows(userId, teamBillingRef ?? undefined)
        : Promise.resolve([]),
    ]);

  const membershipPlan =
    billingPersona === "PLATFORM_CREDIT" && creditAcc?.planId
      ? await prisma.membershipPlan.findUnique({
          where: { id: creditAcc.planId },
          select: { priceYuan: true, interval: true, tier: true, family: true },
        })
      : teamTenant?.planId
        ? await prisma.membershipPlan.findUnique({
            where: { id: teamTenant.planId },
            select: { priceYuan: true, interval: true, tier: true, family: true },
          })
        : null;

  let planPriceLabel: string | null = null;
  if (teamTenant?.planId) {
    try {
      const quote = await quoteTeamPlan({
        planId: teamTenant.planId,
        totalSeats: teamTenant.seatLimit,
      });
      const unit = teamTenant.interval === "YEAR" ? "年" : "月";
      planPriceLabel = `¥${quote.totalPriceYuan.toLocaleString("zh-CN")}/${unit}（${quote.totalSeats} 席）`;
    } catch {
      if (membershipPlan) {
        const fee = Number(membershipPlan.priceYuan);
        const unit = membershipPlan.interval === "YEAR" ? "年" : "月";
        planPriceLabel = `¥${fee.toLocaleString("zh-CN")}/${unit}`;
      }
    }
  } else if (membershipPlan) {
    const fee = Number(membershipPlan.priceYuan);
    const unit = membershipPlan.interval === "YEAR" ? "年" : "月";
    planPriceLabel = `¥${fee.toLocaleString("zh-CN")}/${unit}`;
  }

  const membershipPeriodEnd =
    teamTenant?.currentPeriodEnd ?? creditAcc?.membershipPaidUntil ?? null;

  return {
    billingPersona,
    flags,
    memberAccess,
    creditBalances,
    usageSummary,
    packageUsageRows,
    lotBreakdown,
    membershipPeriodEnd,
    planPriceLabel,
    isTeamSharedPool: Boolean(teamBillingRef),
  };
}

export type AccountOverviewJson = {
  billingPersona: BillingPersona | null;
  flags: Omit<AccountOverviewData["flags"], "subscriptionEndsAt"> & {
    subscriptionEndsAt: string | null;
  };
  memberAccess: AccountOverviewData["memberAccess"];
  creditBalances: AccountOverviewData["creditBalances"];
  usageSummary: AccountOverviewData["usageSummary"];
  packageUsageRows: AccountOverviewData["packageUsageRows"];
  lotBreakdown: {
    source: AccountOverviewData["lotBreakdown"][number]["source"];
    remainingCredits: number;
    expiresAt: string | null;
  }[];
  membershipPeriodEnd: string | null;
  planPriceLabel: string | null;
  isTeamSharedPool: boolean;
};

export function serializeAccountOverview(data: AccountOverviewData): AccountOverviewJson {
  return {
    billingPersona: data.billingPersona,
    flags: {
      ...data.flags,
      subscriptionEndsAt: data.flags.subscriptionEndsAt?.toISOString() ?? null,
    },
    memberAccess: data.memberAccess,
    creditBalances: data.creditBalances,
    usageSummary: data.usageSummary,
    packageUsageRows: data.packageUsageRows,
    lotBreakdown: data.lotBreakdown.map((lot) => ({
      source: lot.source,
      remainingCredits: lot.remainingCredits,
      expiresAt: lot.expiresAt?.toISOString() ?? null,
    })),
    membershipPeriodEnd: data.membershipPeriodEnd?.toISOString() ?? null,
    planPriceLabel: data.planPriceLabel,
    isTeamSharedPool: data.isTeamSharedPool,
  };
}
