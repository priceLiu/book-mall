import Link from "next/link";
import dynamic from "next/dynamic";
import { WalletEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPointsAsYuan } from "@/lib/currency";
import { creditLedgerTypeLabel } from "@/lib/admin/admin-nav-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

const AdminToolUsageBarChart = dynamic(
  () =>
    import("@/components/admin/admin-tool-usage-bar-chart").then(
      (m) => m.AdminToolUsageBarChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        图表加载中…
      </div>
    ),
  },
);

function financeUsageHref(origin: string | null): string {
  return origin ? `${origin}/admin/usage-overview` : "/admin/finance/usage-overview";
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const [
    userCount,
    activeSubscriptions,
    balanceSum,
    rechargeSum,
    rechargeTxCount,
    creditLedgerGroups,
    creditConsumeSum,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: now } },
    }),
    prisma.wallet.aggregate({ _sum: { balancePoints: true } }),
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.RECHARGE },
      _sum: { amountPoints: true },
    }),
    prisma.walletEntry.count({
      where: { type: WalletEntryType.RECHARGE },
    }),
    prisma.creditLedger.groupBy({
      by: ["type"],
      where: { type: { in: ["CONSUME", "SETTLE"] } },
      _count: { id: true },
      _sum: { credits: true },
    }),
    prisma.creditLedger.aggregate({
      where: { type: { in: ["CONSUME", "SETTLE"] } },
      _sum: { credits: true },
      _count: { id: true },
    }),
  ]);

  const totalBalance = balanceSum._sum.balancePoints ?? 0;
  const totalRecharge = rechargeSum._sum.amountPoints ?? 0;
  const totalCreditConsumed = Math.abs(creditConsumeSum._sum.credits ?? 0);

  const financeWebOrigin = getFinanceWebPublicOrigin();
  const usageHref = financeUsageHref(financeWebOrigin);

  const creditChartData = [...creditLedgerGroups]
    .sort(
      (a, b) =>
        Math.abs(b._sum.credits ?? 0) - Math.abs(a._sum.credits ?? 0),
    )
    .map((g) => ({
      label: creditLedgerTypeLabel(g.type),
      count: Math.abs(g._sum.credits ?? 0),
    }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">概览</h1>
        <p className="text-sm text-muted-foreground">
          Book 运营 KPI（用户、课程订阅、钱包）；积分消耗明细见财务控制台。
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link
            href="/pricing-disclosure"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            前台价格公示
          </Link>
          <span className="text-muted-foreground">·</span>
          {financeWebOrigin ? (
            <a
              href={usageHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              费用多维度概览（财务控制台）
            </a>
          ) : (
            <Link
              href={usageHref}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              费用多维度概览
            </Link>
          )}
        </p>
      </div>

      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardDescription>注册用户</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{userCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardDescription>有效课程订阅</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{activeSubscriptions}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            <Link href="/admin/billing" className="font-medium text-primary underline-offset-4 hover:underline">
              课程订阅管理 →
            </Link>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col">
          <CardHeader className="shrink-0 pb-2">
            <CardDescription>累计充值入账（点）</CardDescription>
            <CardTitle className="text-3xl tabular-nums tracking-tight">
              {totalRecharge.toLocaleString("zh-CN")}
              <span className="text-lg font-semibold text-muted-foreground"> 点</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0 text-xs text-muted-foreground">
            <p className="min-h-[3rem] leading-snug">
              钱包流水「充值」合计 · 约合{" "}
              <span className="tabular-nums">¥{formatPointsAsYuan(totalRecharge)}</span>
            </p>
            <Link
              href="/admin/payments"
              className="mt-auto block pt-3 font-medium text-primary underline-offset-4 hover:underline"
            >
              支付核对 →
            </Link>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col">
          <CardHeader className="shrink-0 pb-2">
            <CardDescription>充值笔数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{rechargeTxCount}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0 text-xs text-muted-foreground">
            <p className="min-h-[3rem] leading-snug">钱包 RECHARGE 分录条数</p>
            <Link
              href="/admin/payments"
              className="mt-auto block pt-3 font-medium text-primary underline-offset-4 hover:underline"
            >
              支付核对 →
            </Link>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col sm:col-span-2 xl:col-span-1">
          <CardHeader className="shrink-0 pb-2">
            <CardDescription>全站可用余额合计（点）</CardDescription>
            <CardTitle className="text-3xl tabular-nums tracking-tight">
              {totalBalance.toLocaleString("zh-CN")}
              <span className="text-lg font-semibold text-muted-foreground"> 点</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0 text-xs text-muted-foreground">
            <p className="min-h-[3rem] leading-snug">
              各用户钱包余额之和 · 约合{" "}
              <span className="tabular-nums">¥{formatPointsAsYuan(totalBalance)}</span>
            </p>
            {financeWebOrigin ? (
              <a
                href={usageHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto block pt-3 font-medium text-primary underline-offset-4 hover:underline"
              >
                费用概览（财务控制台）→
              </a>
            ) : (
              <Link
                href={usageHref}
                className="mt-auto block pt-3 font-medium text-primary underline-offset-4 hover:underline"
              >
                费用概览 →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">积分消耗汇总</CardTitle>
          <CardDescription>
            按 <code className="rounded bg-muted px-1 text-xs">CreditLedger</code>{" "}
            的 CONSUME / SETTLE 汇总（点数绝对值）；共{" "}
            <span className="tabular-nums font-medium text-foreground">
              {totalCreditConsumed.toLocaleString("zh-CN")}
            </span>{" "}
            点 · {creditConsumeSum._count.id ?? 0} 条流水
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {creditChartData.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 text-sm text-muted-foreground">
              暂无积分扣减流水。
            </div>
          ) : (
            <AdminToolUsageBarChart data={creditChartData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
