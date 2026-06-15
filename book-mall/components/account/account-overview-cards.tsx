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
  generalCredits: number;
  videoCredits: number;
  billingPersona: BillingPersona | null;
  membershipPlanName: string | null;
  membershipPeriodEnd: Date | null;
  planPriceLabel: string | null;
  hasActiveMembership: boolean;
  hasActiveCourseSubscription: boolean;
  coursePlanName: string | null;
  courseSubscriptionEndsAt: Date | null;
  legacyMonthlyGrantCredits?: number | null;
  usageSummary?: UsageSummary | null;
  packageUsageRows?: PackageUsageRow[];
  /** 当前在团队空间：积分/用量展示团队共享池总量 */
  isTeamSharedPool?: boolean;
};

function personaLabel(persona: BillingPersona | null): string {
  if (persona === "PLATFORM_CREDIT") return "平台代付（积分套餐）";
  if (persona === "BYOK") return "自带 Key（BYOK 月费）";
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

function fmtQuota(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

export function AccountOverviewCards({
  generalCredits,
  videoCredits,
  billingPersona,
  membershipPlanName,
  membershipPeriodEnd,
  planPriceLabel,
  hasActiveMembership,
  hasActiveCourseSubscription,
  coursePlanName,
  courseSubscriptionEndsAt,
  legacyMonthlyGrantCredits = null,
  usageSummary = null,
  packageUsageRows = [],
  isTeamSharedPool = false,
}: Props) {
  const isByok = billingPersona === "BYOK";
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
            注册时选定的计费方式；与下方套餐状态共同决定工具与 AI 调用权限。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-200">
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
              <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1 text-xs text-sky-800 dark:text-sky-200">
                团队共享池 · 全员合计
              </span>
            ) : null}
          </div>
          {membershipPeriodEnd ? (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              当前周期至 {membershipPeriodEnd.toLocaleDateString("zh-CN")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 套餐使用情况 */}
      {packageUsageRows.length > 0 ? (
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isByok ? "套餐使用情况" : isTeamSharedPool ? "团队本月消耗" : "本月按类型消耗"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isByok
                ? "剩余 = 总数 − 套餐已用（与 Gateway 成功次数可能不同：仅 BYOK 套餐内扣次计入已用）。试衣计入文生图。"
                : isTeamSharedPool
                  ? "团队共享积分池按七类统计全员成功/失败与扣积分（试衣计入文生图）。"
                  : "积分池按七类统计成功/失败与扣积分（无含次额度；试衣计入文生图，明细按 modelKey 展示）。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full min-w-[420px] text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">类型</th>
                    {isByok ? (
                      <>
                        <th className="px-3 py-2 text-right font-medium">总数</th>
                        <th className="px-3 py-2 text-right font-medium">套餐已用</th>
                        <th className="px-3 py-2 text-right font-medium">剩余</th>
                        <th className="px-3 py-2 text-right font-medium">Gateway 成功</th>
                        <th className="px-3 py-2 text-right font-medium">失败</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 text-right font-medium">成功</th>
                        <th className="px-3 py-2 text-right font-medium">失败</th>
                        <th className="px-3 py-2 text-right font-medium">扣积分</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {packageUsageRows.map((row) => (
                    <tr key={row.key} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                      {isByok ? (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtQuota(row.total)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-[#262626]">
                            {fmtQuota(row.includedUsed)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtQuota(row.remaining)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {row.succeeded}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-destructive">
                            {row.failed}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {row.succeeded}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-destructive">
                            {row.failed}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {(row.creditsConsumed ?? 0).toLocaleString("zh-CN")}
                          </td>
                        </>
                      )}
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
              {isByok ? "轻量包积分" : isTeamSharedPool ? "团队套餐积分" : "套餐积分"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isByok
                ? "轻量包加购与超额扣分；BYOK 月费不含月度积分发放。"
                : isTeamSharedPool
                  ? "团队共享池本月发放、消耗与剩余（含轻量包加购）。"
                  : "套餐月发积分与轻量包加购；用于平台代付扣费。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <UsageStat
                label={isByok ? "轻量包加购" : "本月发放"}
                value={
                  isByok ? usageSummary.topupCreditsThisMonth : usageSummary.creditsGranted
                }
              />
              <UsageStat label="本月消耗" value={usageSummary.creditsConsumed} />
              <UsageStat label="剩余积分" value={usageSummary.creditsRemaining} />
            </div>
            {isByok && usageSummary.grantCreditsThisMonth > 0 && usageSummary.topupCreditsThisMonth === 0 ? (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                本月另有历史套餐月发 {usageSummary.grantCreditsThisMonth.toLocaleString("zh-CN")}{" "}
                积分（切换 BYOK 前的 GRANT 流水，非轻量包加购）。
              </p>
            ) : null}
            {!isByok && usageSummary.topupCreditsThisMonth > 0 ? (
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
              {isByok ? "当前余额" : isTeamSharedPool ? "团队积分余额" : "积分余额"}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            {isByok
              ? "通用池用于超额任务与各工具月费"
              : isTeamSharedPool
                ? "团队共享通用 + 视频池"
                : "通用 + 视频池 · 套餐月积分 + 轻量包"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className={accountOverviewCardBodyClass()}>
            <div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {generalCredits.toLocaleString("zh-CN")}{" "}
                <span className="text-base font-medium text-muted-foreground">通用</span>
              </p>
              {videoCredits > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  视频池 {videoCredits.toLocaleString("zh-CN")} 积分
                  {isByok ? "（历史结余）" : null}
                </p>
              ) : null}
            </div>
            {legacyMonthlyGrantCredits && legacyMonthlyGrantCredits > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                账户仍关联历史月发配置（{legacyMonthlyGrantCredits.toLocaleString("zh-CN")} 通用/月），BYOK
                下不再刷新。
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 会员 / BYOK 套餐状态 */}
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{isByok ? "BYOK 套餐" : "会员套餐"}</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            {isByok ? "BYOK 技术服务费 + 自备厂商 Key" : "个人或团队积分套餐"}
          </CardDescription>
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
            {isByok ? (
              <Link href="/account/byok" className={accountInlineLinkClass()}>
                BYOK 管理
              </Link>
            ) : (
              <Link href="/account/team" className={accountInlineLinkClass()}>
                团队空间
              </Link>
            )}
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
