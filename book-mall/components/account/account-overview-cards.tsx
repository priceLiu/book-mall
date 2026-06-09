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
import { cn } from "@/lib/utils";

type ByokQuotaSummary = {
  label: string;
  monthlyIncluded: number;
  overageCredits: number;
};

type ByokTaskUsageSummary = {
  label: string;
  monthlyIncluded: number;
  includedUsed: number;
  includedRemaining: number;
};

type UsageSummary = {
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
  hasActiveMembership: boolean;
  hasActiveCourseSubscription: boolean;
  coursePlanName: string | null;
  courseSubscriptionEndsAt: Date | null;
  /** BYOK 套餐内月度任务额度（不含积分） */
  byokQuotas?: ByokQuotaSummary[];
  /** BYOK 账户上残留的平台套餐月发配置（历史数据），非 BYOK 月费发放 */
  legacyMonthlyGrantCredits?: number | null;
  /** 本月积分与调用摘要 */
  usageSummary?: UsageSummary | null;
  /** BYOK 本月任务含/已用/剩余 */
  byokTaskSummary?: ByokTaskUsageSummary[];
};

function personaLabel(persona: BillingPersona | null): string {
  if (persona === "PLATFORM_CREDIT") return "平台代付（积分套餐）";
  if (persona === "BYOK") return "自带 Key（BYOK 月费）";
  return "未完成身份选择";
}

/** 状态点：绿 / 灰 */
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
  generalCredits,
  videoCredits,
  billingPersona,
  membershipPlanName,
  membershipPeriodEnd,
  hasActiveMembership,
  hasActiveCourseSubscription,
  coursePlanName,
  courseSubscriptionEndsAt,
  byokQuotas = [],
  legacyMonthlyGrantCredits = null,
  usageSummary = null,
  byokTaskSummary = [],
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
          <div className="flex flex-wrap gap-2">
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
          </div>
          {isByok && byokQuotas.length > 0 ? (
            <ul className="mt-3 space-y-1 rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              <li className="font-medium text-foreground">本月套餐内任务额度（不含积分）</li>
              {byokQuotas.map((q) => (
                <li key={q.label}>
                  {q.label}：{q.monthlyIncluded} 次/月 · 超额 {q.overageCredits} 积分/次
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {/* 本月用量摘要 */}
      {usageSummary ? (
        <Card className="flex h-full flex-col md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">本月用量摘要</CardTitle>
            <CardDescription className="text-xs">
              积分发放/消耗/剩余与成功调用次数；明细请打开财务模块查看。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <UsageStat label="本月发放积分" value={usageSummary.creditsGranted} />
              <UsageStat label="本月已用积分" value={usageSummary.creditsConsumed} />
              <UsageStat label="剩余积分" value={usageSummary.creditsRemaining} />
              <UsageStat label="本月成功调用" value={usageSummary.totalCallsThisMonth} />
            </div>
            {isByok && byokTaskSummary.length > 0 ? (
              <div className="rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-xs font-medium text-foreground">BYOK 套餐内任务（本月）</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {byokTaskSummary.map((t) => (
                    <li key={t.label} className="flex flex-wrap gap-x-2 tabular-nums">
                      <span className="text-foreground">{t.label}</span>
                      <span>
                        含 {t.monthlyIncluded} · 已用 {t.includedUsed} · 剩余 {t.includedRemaining}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className={accountOverviewCardFooterClass()}>
              <a
                href={financeUsageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={textLink}
              >
                查看用量明细
              </a>
              <a
                href={getFinanceFeesRedirectUrl("/fees/billing/details?tab=usage") ?? "/account/fees/details"}
                target="_blank"
                rel="noopener noreferrer"
                className={textLink}
              >
                账单详情
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
              {isByok ? "轻量包余额" : "积分余额"}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            {isByok
              ? "用于超额任务扣分与各工具月费；BYOK 月费不含月度积分发放"
              : "套餐月积分 + 轻量包加购 · 用于平台 Key 生成扣费"}
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
                  {isByok ? "（历史套餐结余，BYOK 超额不走视频池）" : null}
                </p>
              ) : null}
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {isByok ? (
                <>
                  BYOK 套餐按<b className="font-medium text-foreground">次数</b>计费，不按月发积分。
                  余额来自轻量包加购或历史平台套餐结余；每笔变动见侧栏「积分流水」。
                  {legacyMonthlyGrantCredits && legacyMonthlyGrantCredits > 0 ? (
                    <span className="mt-1 block text-amber-700 dark:text-amber-400">
                      账户仍关联历史月发配置（{legacyMonthlyGrantCredits.toLocaleString("zh-CN")}{" "}
                      通用/月），切换 BYOK 后不再刷新。
                    </span>
                  ) : null}
                </>
              ) : (
                <>套餐积分按月重置；用完可在「轻量包」即时加购。</>
              )}
            </div>
          </div>
          <div className={accountOverviewCardFooterClass()}>
            <Link href="/account/billing" className={accountInlineLinkClass()}>
              轻量包购买
            </Link>
            {isByok ? (
              <>
                <a
                  href={financeUsageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={textLink}
                >
                  积分用量
                </a>
                <a
                  href={financeLedgerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={textLink}
                >
                  积分流水
                </a>
              </>
            ) : (
              <Link href="/pricing" className={accountInlineLinkClass()}>
                会员套餐
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 会员套餐 / BYOK 套餐 */}
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{isByok ? "BYOK 套餐" : "会员套餐"}</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            {billingPersona === "BYOK"
              ? "BYOK 技术服务费 + 自备厂商 Key"
              : "个人或团队积分套餐 · 解锁全部 AI 工具"}
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
              {membershipPeriodEnd ? (
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  有效期至 {membershipPeriodEnd.toLocaleDateString("zh-CN")}
                </p>
              ) : null}
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              AI 学堂课程会员：
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
              {courseSubscriptionEndsAt ? (
                <span className="ml-1 tabular-nums">
                  · 至 {courseSubscriptionEndsAt.toLocaleDateString("zh-CN")}
                </span>
              ) : null}
            </div>
          </div>
          <div className={accountOverviewCardFooterClass()}>
            <Link href="/pricing" className={accountInlineLinkClass()}>
              选购套餐
            </Link>
            {billingPersona === "BYOK" ? (
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
