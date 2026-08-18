import Link from "next/link";
import { Wallet, BadgeCheck } from "lucide-react";
import type { BillingPersona } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  accountInlineLinkClass,
  accountBodyTextLinkClass,
  accountOverviewCardBodyClass,
  accountOverviewCardFooterClass,
} from "@/components/account/account-nav-styles";
import { getFinanceFeesRedirectUrl } from "@/lib/finance-account-redirect";
import type { PackageUsageRow } from "@/lib/finance/account-usage-summary";
import { cn } from "@/lib/utils";

type UsageSummary = {
  topupCreditsThisMonth: number;
  grantCreditsThisMonth: number;
  adjustCreditsThisMonth: number;
  creditsGranted: number;
  creditsConsumed: number;
  creditsRemaining: number;
  totalCallsThisMonth: number;
};

type Props = {
  totalCredits: number;
  billingPersona: BillingPersona | null;
  membershipPlanName: string | null;
  membershipPeriodEnd: Date | null;
  planPriceLabel: string | null;
  hasActiveMembership: boolean;
  hasActiveCourseSubscription: boolean;
  coursePlanName: string | null;
  courseSubscriptionEndsAt: Date | null;
  usageSummary?: UsageSummary | null;
  packageUsageRows?: PackageUsageRow[];
  /** 当前在团队空间：积分/用量展示团队共享池总量 */
  isTeamSharedPool?: boolean;
};

function personaLabel(persona: BillingPersona | null): string {
  if (persona === "PLATFORM_CREDIT" || persona === "BYOK") return "订阅会员（平台代付）";
  return "未完成身份选择";
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-2 w-2 shrink-0 rounded-full",
        ok ? "bg-emerald-500" : "bg-muted-foreground/40",
      )}
      aria-hidden
    />
  );
}

export function AccountOverviewCards({
  totalCredits,
  billingPersona,
  membershipPlanName,
  membershipPeriodEnd,
  planPriceLabel,
  hasActiveMembership,
  hasActiveCourseSubscription,
  coursePlanName,
  courseSubscriptionEndsAt,
  usageSummary = null,
  packageUsageRows = [],
  isTeamSharedPool = false,
}: Props) {
  const textLink = accountBodyTextLinkClass();
  const financeUsageUrl = getFinanceFeesRedirectUrl("/fees/usage") ?? "/account/usage";
  const financeLedgerUrl = getFinanceFeesRedirectUrl("/fees/billing/ledger") ?? "/account/fees/ledger";

  return (
    <section className="grid items-stretch gap-4 md:grid-cols-2">
      {/* 账户身份 */}
      <Card className="flex h-full flex-col md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">账户身份</CardTitle>
          <CardDescription className="text-xs">
            订阅会员通过积分套餐使用 AI；下方为当前套餐与用量。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-foreground">
              {personaLabel(billingPersona)}
            </span>
            {membershipPlanName ? (
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-foreground">
                套餐：{membershipPlanName}
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground">
                暂无有效套餐
              </span>
            )}
            {planPriceLabel ? (
              <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                {planPriceLabel}
              </span>
            ) : null}
            {isTeamSharedPool ? (
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                团队共享池 · 全员合计
              </span>
            ) : null}
          </div>
          {membershipPeriodEnd ? (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              会员服务至 {membershipPeriodEnd.toLocaleString("zh-CN")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 套餐使用情况 */}
      {packageUsageRows.length > 0 ? (
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isTeamSharedPool ? "团队本月消耗" : "本月按类型消耗"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isTeamSharedPool
                ? "团队共享积分池按七类统计全员成功/失败与扣积分（试衣计入文生图）。"
                : "积分池按七类统计成功/失败与扣积分（试衣计入文生图，明细按 modelKey 展示）。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full min-w-[420px] text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">类型</th>
                    <th className="px-3 py-2 text-right font-medium">成功</th>
                    <th className="px-3 py-2 text-right font-medium">失败</th>
                    <th className="px-3 py-2 text-right font-medium">扣积分</th>
                  </tr>
                </thead>
                <tbody>
                  {packageUsageRows.map((row) => (
                    <tr key={row.key} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {row.succeeded}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-destructive">
                        {row.failed}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {(row.creditsConsumed ?? 0).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {usageSummary ? (
              <p className="text-xs text-muted-foreground">
                本月 Gateway 成功调用合计 {usageSummary.totalCallsThisMonth.toLocaleString("zh-CN")} 次
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* 轻量包 / 积分 */}
      {usageSummary ? (
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isTeamSharedPool ? "团队套餐积分" : "套餐积分"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isTeamSharedPool
                ? "团队共享池本月发放、消耗与剩余（含轻量包加购）。"
                : "套餐月发积分与轻量包加购；用于平台代付扣费。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <UsageStat label="本月发放" value={usageSummary.creditsGranted} />
              <UsageStat label="本月消耗" value={usageSummary.creditsConsumed} />
              <UsageStat label="剩余积分" value={usageSummary.creditsRemaining} />
            </div>
            {usageSummary.topupCreditsThisMonth > 0 ? (
              <p className="text-xs text-muted-foreground">
                其中轻量包加购 {usageSummary.topupCreditsThisMonth.toLocaleString("zh-CN")} 积分
              </p>
            ) : null}
            <div className={accountOverviewCardFooterClass()}>
              <Link href="/account/billing" className={accountInlineLinkClass()}>
                轻量包购买
              </Link>
              <a href={financeUsageUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                用量明细
              </a>
              <a href={financeLedgerUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                积分流水
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 积分余额 */}
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {isTeamSharedPool ? "团队积分余额" : "积分余额"}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            {isTeamSharedPool
              ? "团队共享积分池"
              : "套餐月积分 + 轻量包"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className={accountOverviewCardBodyClass()}>
            <div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {totalCredits.toLocaleString("zh-CN")}
                <span className="text-base font-medium text-muted-foreground"> 积分</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 会员套餐状态 */}
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">会员套餐</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">个人或团队积分套餐</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className={accountOverviewCardBodyClass()}>
            <div>
              <div className="flex items-center gap-2">
                <StatusDot ok={hasActiveMembership} />
                <p className="text-lg font-semibold leading-none">
                  {hasActiveMembership ? "有效" : "未开通"}
                </p>
              </div>
              <p className="mt-2 text-sm text-foreground">
                {membershipPlanName ?? (
                  <span className="text-muted-foreground">暂无有效套餐</span>
                )}
              </p>
              {planPriceLabel ? (
                <p className="mt-1 text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                  {planPriceLabel}
                </p>
              ) : null}
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              AI 学堂：
              <span
                className={cn(
                  "ml-1 font-medium",
                  hasActiveCourseSubscription
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-muted-foreground",
                )}
              >
                {hasActiveCourseSubscription
                  ? (coursePlanName ?? "已开通")
                  : "未开通（与工具套餐独立）"}
              </span>
            </div>
          </div>
          <div className={accountOverviewCardFooterClass()}>
            <Link href="/pricing" className={accountInlineLinkClass()}>
              选购套餐
            </Link>
            <Link href="/account/team" className={accountInlineLinkClass()}>
              团队空间
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value.toLocaleString("zh-CN")}</p>
    </div>
  );
}
