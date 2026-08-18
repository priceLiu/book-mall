import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getMembershipFlags } from "@/lib/membership";
import { getMembershipToolAccess } from "@/lib/membership-tool-access";
import { getAccountCreditBalances, getLotBreakdown } from "@/lib/billing/credit-account-service";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import {
  getAccountPlatformCategoryUsageRows,
  getAccountUsageSummary,
} from "@/lib/finance/account-usage-summary";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountOverviewCards } from "@/components/account/account-overview-cards";
import { CreditLotBreakdown } from "@/components/account/credit-lot-breakdown";
import { AccountDevActions } from "@/components/account/account-dev-actions";
import { prisma } from "@/lib/prisma";
import { runDbQuery } from "@/lib/db-query";
import { getActiveTenantContext } from "@/lib/tenant/context";
import type { BillingPersona } from "@prisma/client";

export const metadata = {
  title: "概览 — 个人中心",
};

function toolsSsoErrBanner(code: string): { title: string; body: string } | null {
  switch (code) {
    case "TOOLS_ACCESS_DENIED":
      return {
        title: "未能打开 AI 工具站",
        body:
          "当前账号不满足工具站准入：须为主站管理员，或持有有效会员套餐（个人或团队）。请在「会员套餐」页选购。",
      };
    case "SSO_CODE_PERSIST_FAILED":
      return {
        title: "工具站签发失败（数据库）",
        body: "请在 book-mall 执行 `pnpm run db:deploy` 后重启主站，再试。",
      };
    case "TOOLS_SSO_SECRETS_MISSING":
    case "TOOLS_PUBLIC_ORIGIN_INVALID":
    case "TOOLS_SSO_UNAVAILABLE":
      return {
        title: "工具站 SSO 未就绪",
        body: "请检查 TOOLS_PUBLIC_ORIGIN、TOOLS_SSO_* 环境变量。",
      };
    default:
      return {
        title: "工具站跳转未完成",
        body: `服务端返回「${code}」。请稍后从侧栏重新打开应用。`,
      };
  }
}

type AccountOverviewData = {
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

async function loadAccountOverview(userId: string): Promise<AccountOverviewData> {
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

  const [creditBalances, creditAcc, usageSummary, teamTenant, lotBreakdown] =
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
    ]);

  const packageUsageRows =
    billingPersona === "BYOK" || billingPersona === "PLATFORM_CREDIT"
      ? await getAccountPlatformCategoryUsageRows(userId, teamBillingRef ?? undefined)
      : [];

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
    teamTenant?.currentPeriodEnd ??
    creditAcc?.membershipPaidUntil ??
    null;

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

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: { tools_sso_err?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const toolsSsoErr =
    typeof searchParams?.tools_sso_err === "string"
      ? searchParams.tools_sso_err.trim()
      : "";
  const toolsBanner =
    toolsSsoErr.length > 0 ? toolsSsoErrBanner(toolsSsoErr) : null;

  const overview = await runDbQuery(
    "AccountPage",
    () => loadAccountOverview(session.user.id),
    null,
  );

  return (
    <>
      {toolsBanner ? (
        <div
          role="alert"
          className="mb-6 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">{toolsBanner.title}</p>
            <p className="leading-relaxed text-muted-foreground">{toolsBanner.body}</p>
          </div>
        </div>
      ) : null}

      <AccountSectionHeader
        title="概览"
        description="积分、计费身份与套餐状态一览；其它模块请用左侧菜单切换。"
      />

      {!overview ? (
        <p className="text-sm text-muted-foreground">
          内容加载中，若长时间空白请刷新页面。
        </p>
      ) : (
        <>
          <AccountOverviewCards
            totalCredits={overview.creditBalances.balance}
            billingPersona={overview.billingPersona}
            membershipPlanName={overview.memberAccess.planName}
            membershipPeriodEnd={overview.membershipPeriodEnd}
            planPriceLabel={overview.planPriceLabel}
            hasActiveMembership={overview.memberAccess.ok}
            hasActiveCourseSubscription={
              overview.flags.hasActiveCourseProductSubscription ||
              overview.flags.hasActiveSubscription
            }
            coursePlanName={overview.flags.membershipPlanName}
            courseSubscriptionEndsAt={overview.flags.subscriptionEndsAt}
            usageSummary={overview.usageSummary}
            packageUsageRows={overview.packageUsageRows}
            isTeamSharedPool={overview.isTeamSharedPool}
          />

          <CreditLotBreakdown lots={overview.lotBreakdown} />
        </>
      )}

      {process.env.NODE_ENV === "development" ? (
        <section className="mt-8">
          <AccountDevActions />
        </section>
      ) : null}
    </>
  );
}
