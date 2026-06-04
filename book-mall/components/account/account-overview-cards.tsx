import Link from "next/link";
import { Wallet, BadgeCheck, Zap, Check, Dot } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { accountInlineLinkClass } from "@/components/account/account-nav-styles";
import { cn } from "@/lib/utils";
import { LaunchToolsAppButton } from "@/components/account/launch-tools-app";
import { AccountCanvasCard } from "@/components/account/account-canvas-card";
import { formatPointsAsYuan } from "@/lib/currency";
import { PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS } from "@/lib/pricing-disclosure-view";

type Props = {
  balancePoints: number;
  minBalanceLinePoints: number;
  canUsePremiumMetered: boolean;
  hasActiveSubscription: boolean;
  membershipPlanName: string | null;
  subscriptionEndsAt: Date | null;
  hasActiveToolProductSubscription: boolean;
  /** Phase D：至少一个有效工具技术服务费周期 */
  hasActiveToolService: boolean;
  goldIsActive: boolean;
  goldMinBalanceLinePoints: number;
  goldHasRechargeHistory: boolean;
  canLaunchTools: boolean;
  showToolsCta: boolean;
  gatewayLinked: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
};

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

/** 单条 checklist 行 */
function ChecklistRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed">
      {ok ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
      ) : (
        <Dot className="-mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
      )}
      <span className={cn(ok ? "text-foreground" : "text-muted-foreground")}>
        {children}
      </span>
    </li>
  );
}

export function AccountOverviewCards({
  balancePoints,
  minBalanceLinePoints,
  canUsePremiumMetered,
  hasActiveSubscription,
  membershipPlanName,
  subscriptionEndsAt,
  hasActiveToolProductSubscription,
  hasActiveToolService,
  goldIsActive: _goldIsActive,
  goldMinBalanceLinePoints: _goldMinBalanceLinePoints,
  goldHasRechargeHistory: _goldHasRechargeHistory,
  canLaunchTools,
  showToolsCta,
  gatewayLinked,
  canLaunchCanvas,
  canvasOriginConfigured,
}: Props) {
  const balanceYuan = formatPointsAsYuan(balancePoints);
  const minBalanceYuan = formatPointsAsYuan(minBalanceLinePoints);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* 钱包余额 */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">钱包余额</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            100 点 = 1 元 · 主要用于支付工具技术服务费
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-3">
          <div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {balancePoints.toLocaleString("zh-CN")}{" "}
              <span className="text-base font-medium text-muted-foreground">点</span>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              ≈ ¥{balanceYuan}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <p>
              最低可用线 {minBalanceLinePoints.toLocaleString("zh-CN")} 点（¥
              {minBalanceYuan}）
            </p>
            <p className="mt-1">
              高阶 / 按量可用：
              <span
                className={cn(
                  "ml-1 font-medium",
                  canUsePremiumMetered ? "text-emerald-600 dark:text-emerald-500" : "text-foreground",
                )}
              >
                {canUsePremiumMetered ? "是" : "否"}
              </span>
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <Link href="/pay/mock-topup" className={accountInlineLinkClass()}>
              充值
            </Link>
            <Link href="/account/recharge-promos" className={accountInlineLinkClass()}>
              优惠券
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 订阅状态 */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">订阅状态</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            会员计划 · AI 学堂（不含工具使用权）
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusDot ok={hasActiveSubscription} />
              <p className="text-lg font-semibold leading-none">
                {hasActiveSubscription ? "有效" : "未开通"}
              </p>
            </div>
            <p className="mt-2 text-sm text-foreground">
              {membershipPlanName ?? <span className="text-muted-foreground">暂无会员计划</span>}
            </p>
            {subscriptionEndsAt ? (
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                有效期至 {subscriptionEndsAt.toLocaleDateString("zh-CN")}
              </p>
            ) : null}
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            工具技术服务费：
            <Link href="/account/tool-service-fee" className={cn("ml-1", accountInlineLinkClass())}>
              {hasActiveToolService ? "已开通" : "未开通"}
            </Link>
          </div>
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <Link href="/account/subscription" className={accountInlineLinkClass()}>
              订阅中心
            </Link>
            <Link href="/account/tool-service-fee" className={accountInlineLinkClass()}>
              工具月费
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* AI 工具站 */}
      <Card className="flex flex-col md:col-span-2 xl:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">AI 工具站</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            有效工具技术服务费 + Gateway BYOK
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusDot ok={hasActiveToolService} />
              <p className="text-lg font-semibold leading-none">
                {hasActiveToolService ? "已开放" : "未开通"}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              须在「工具技术服务费」页开通对应分组；单次生成不另扣点。
            </p>
          </div>
          <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2">
            <ChecklistRow ok={hasActiveToolService}>有效工具技术服务费</ChecklistRow>
            <ChecklistRow ok={balancePoints > 0}>钱包有余额（开通/续订时扣费）</ChecklistRow>
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {showToolsCta ? (
              <LaunchToolsAppButton
                enabled={canLaunchTools}
                label="打开工具站"
                variant="subscription"
                openInNewTab
                layout="nav"
              />
            ) : (
              <span className="text-sm text-muted-foreground">工具站 SSO 未配置</span>
            )}
            <a href={PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS} className={accountInlineLinkClass()}>
              价目表
            </a>
          </div>
        </CardContent>
      </Card>

      <AccountCanvasCard
        gatewayLinked={gatewayLinked}
        canLaunchCanvas={canLaunchCanvas}
        canvasOriginConfigured={canvasOriginConfigured}
      />
    </section>
  );
}
