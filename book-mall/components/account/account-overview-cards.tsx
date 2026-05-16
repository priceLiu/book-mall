import Link from "next/link";
import { Wallet, BadgeCheck, Zap, Check, Dot } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LaunchToolsAppButton } from "@/components/account/launch-tools-app";
import { formatPointsAsYuan } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Props = {
  balancePoints: number;
  minBalanceLinePoints: number;
  canUsePremiumMetered: boolean;
  hasActiveSubscription: boolean;
  membershipPlanName: string | null;
  subscriptionEndsAt: Date | null;
  hasActiveToolProductSubscription: boolean;
  goldIsActive: boolean;
  goldMinBalanceLinePoints: number;
  goldHasRechargeHistory: boolean;
  canLaunchTools: boolean;
  showToolsCta: boolean;
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
  goldIsActive,
  goldMinBalanceLinePoints,
  goldHasRechargeHistory,
  canLaunchTools,
  showToolsCta,
}: Props) {
  const balanceYuan = formatPointsAsYuan(balancePoints);
  const minBalanceYuan = formatPointsAsYuan(minBalanceLinePoints);
  const goldMinBalanceYuan = formatPointsAsYuan(goldMinBalanceLinePoints);

  /** 工具站准入：黄金会员 + （计划 OR 单品） */
  const hasPlanOrTool = hasActiveSubscription || hasActiveToolProductSubscription;
  const toolsReady = goldIsActive && hasPlanOrTool;

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* 钱包余额 */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">钱包余额</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            100 点 = 1 元 · 实际可用余额
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
          <div className="mt-auto flex gap-2 pt-1">
            <Button asChild variant="subscription" size="sm" className="flex-1">
              <Link href="/pay/mock-topup">充值</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/account/recharge-promos">优惠券</Link>
            </Button>
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
            会员计划 · AI 学堂 · 工具单品
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
            单品工具订阅：
            <span className="ml-1 font-medium text-foreground">
              {hasActiveToolProductSubscription ? "有" : "无"}
            </span>
          </div>
          <div className="mt-auto flex gap-2 pt-1">
            <Button asChild variant="subscription" size="sm" className="flex-1">
              <Link href="/account/subscription">订阅中心</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/courses">AI 学堂</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI 工具站 */}
      <Card className="flex flex-col md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">AI 工具站</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <CardDescription className="text-xs">
            黄金会员 + 计划/单品订阅 = 准入
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusDot ok={toolsReady} />
              <p className="text-lg font-semibold leading-none">
                {toolsReady ? "已开放" : "未达标"}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              准入门槛 ≥ {goldMinBalanceLinePoints.toLocaleString("zh-CN")} 点
              （¥{goldMinBalanceYuan}）+ 历史有充值记录
            </p>
          </div>
          <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2">
            <ChecklistRow ok={goldHasRechargeHistory}>有充值记录</ChecklistRow>
            <ChecklistRow ok={balancePoints >= goldMinBalanceLinePoints}>
              余额达标
            </ChecklistRow>
            <ChecklistRow ok={hasActiveSubscription}>会员计划有效</ChecklistRow>
            <ChecklistRow ok={hasActiveToolProductSubscription}>
              或工具单品有效
            </ChecklistRow>
          </ul>
          <div className="mt-auto flex gap-2 pt-1">
            {showToolsCta ? (
              <div className="flex-1">
                <LaunchToolsAppButton
                  enabled={canLaunchTools}
                  variant="subscription"
                  label="打开工具站"
                  openInNewTab
                  className="w-full"
                />
              </div>
            ) : (
              <Button
                variant="subscription"
                size="sm"
                className="flex-1"
                disabled
                title="未达准入门槛"
              >
                打开工具站
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/account/pricing">价目表</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
