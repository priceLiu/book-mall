import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getActiveByokSubscription } from "@/lib/billing/byok-subscription-service";
import { getMembershipFlags } from "@/lib/membership";
import { getMembershipToolAccess } from "@/lib/membership-tool-access";
import { getPoolBalances, getLotBreakdown } from "@/lib/billing/credit-account-service";
import { quoteTeamPlan } from "@/lib/billing/seat-billing-service";
import {
  getAccountPackageUsageRows,
  getAccountPlatformCategoryUsageRows,
  getAccountUsageSummary,
} from "@/lib/finance/account-usage-summary";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { AccountOverviewCards } from "@/components/account/account-overview-cards";
import { CreditLotBreakdown } from "@/components/account/credit-lot-breakdown";
import { AccountDevActions } from "@/components/account/account-dev-actions";
import { prisma } from "@/lib/prisma";
import { getActiveTenantContext } from "@/lib/tenant/context";

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

  const billingPersona = await getUserBillingPersona(session.user.id);
  const activeCtx = await getActiveTenantContext(session.user.id);

  const byokSubPromise =
    billingPersona === "BYOK"
      ? getActiveByokSubscription({ ownerType: "USER", ownerId: session.user.id })
      : Promise.resolve(null);

  const [flags, memberAccess, byokSub] = await Promise.all([
    getMembershipFlags(session.user.id),
    getMembershipToolAccess(session.user.id),
    byokSubPromise,
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
        userId: session.user.id,
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
    ownerId: session.user.id,
  };

  const [poolBalances, creditAcc, usageSummary, teamTenant, lotBreakdown] = await Promise.all([
    getPoolBalances(billingRef),
    prisma.creditAccount.findUnique({
      where: {
        ownerType_ownerId: billingRef,
      },
      select: { currentPeriodEnd: true, membershipPaidUntil: true, planId: true, monthlyGrantCredits: true },
    }),
    getAccountUsageSummary(session.user.id, teamBillingRef ?? undefined),
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
    billingPersona === "BYOK"
      ? await getAccountPackageUsageRows(session.user.id, byokSub?.scopeKey ?? null)
      : billingPersona === "PLATFORM_CREDIT"
        ? await getAccountPlatformCategoryUsageRows(
            session.user.id,
            teamBillingRef ?? undefined,
          )
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
    byokSub?.periodEnd ??
    null;

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

      <AccountOverviewCards
        generalCredits={poolBalances.general.balance}
        videoCredits={poolBalances.video.balance}
        billingPersona={billingPersona}
        membershipPlanName={memberAccess.planName}
        membershipPeriodEnd={membershipPeriodEnd}
        planPriceLabel={planPriceLabel}
        hasActiveMembership={memberAccess.ok}
        hasActiveCourseSubscription={flags.hasActiveCourseProductSubscription || flags.hasActiveSubscription}
        coursePlanName={flags.membershipPlanName}
        courseSubscriptionEndsAt={flags.subscriptionEndsAt}
        legacyMonthlyGrantCredits={
          billingPersona === "BYOK" && creditAcc?.monthlyGrantCredits
            ? creditAcc.monthlyGrantCredits
            : null
        }
        usageSummary={usageSummary}
        packageUsageRows={packageUsageRows}
        isTeamSharedPool={Boolean(teamBillingRef)}
      />

      <CreditLotBreakdown lots={lotBreakdown} />

      {process.env.NODE_ENV === "development" ? (
        <section className="mt-8">
          <AccountDevActions />
        </section>
      ) : null}
    </>
  );
}
