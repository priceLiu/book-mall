import Link from "next/link";
import dynamic from "next/dynamic";
import { WalletEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPointsAsYuan } from "@/lib/currency";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default async function AdminDashboardPage() {
  const now = new Date();
  const [
    userCount,
    activeSubscriptions,
    balanceSum,
    rechargeSum,
    rechargeTxCount,
    toolUsageGroups,
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
    prisma.toolUsageEvent.groupBy({
      by: ["toolKey"],
      orderBy: { toolKey: "asc" },
      _count: { id: true },
    }),
  ]);

  const totalBalance = balanceSum._sum.balancePoints ?? 0;
  const totalRecharge = rechargeSum._sum.amountPoints ?? 0;

  const toolUsageChartData = [...toolUsageGroups]
    .sort(
      (a, b) =>
        ((b._count as { id: number } | undefined)?.id ?? 0) -
        ((a._count as { id: number } | undefined)?.id ?? 0),
    )
    .map((g) => ({
      label: toolKeyToLabel(g.toolKey),
      count: (g._count as { id: number } | undefined)?.id ?? 0,
    }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">概览</h1>
        <p className="text-sm text-muted-foreground">
          用户、订阅与资金汇总（账本为<strong className="font-medium text-foreground">点</strong>，100 点 = 1
          元）；充值与工具消耗明细见对应入口。
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link href="/admin/finance/reconciliation" className="font-medium text-primary underline-offset-4 hover:underline">
            财务核对
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/pricing-disclosure"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            前台价格公示
          </Link>
        </p>
      </div>

      <div className="grid gap-4 items-stretch sm:grid-cols-2 xl:grid-cols-5">
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardDescription>注册用户</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{userCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardDescription>有效订阅</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{activeSubscriptions}</CardTitle>
          </CardHeader>
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
              钱包流水类型「充值」的 <code className="rounded bg-muted px-1">amountPoints</code> 之和（含营销赠送点数）
              · 约合 <span className="tabular-nums">¥{formatPointsAsYuan(totalRecharge)}</span>
            </p>
            <Link
              href="/admin/finance/recharges"
              className="mt-auto block pt-3 font-medium text-primary underline-offset-4 hover:underline"
            >
              查看充值明细 →
            </Link>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col">
          <CardHeader className="shrink-0 pb-2">
            <CardDescription>充值笔数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{rechargeTxCount}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-0 text-xs text-muted-foreground">
            <p className="min-h-[3rem] leading-snug">
              钱包流水类型为「充值」的分录条数（入账次数口径）
            </p>
            <Link
              href="/admin/finance/recharges"
              className="mt-auto block pt-3 font-medium text-primary underline-offset-4 hover:underline"
            >
              充值明细 →
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
              各用户 <code className="rounded bg-muted px-1">Wallet.balancePoints</code> 之和 · 约合{" "}
              <span className="tabular-nums">¥{formatPointsAsYuan(totalBalance)}</span>
            </p>
            <Link
              href="/admin/tool-usage"
              className="mt-auto block pt-3 font-medium text-primary underline-offset-4 hover:underline"
            >
              查看工具使用明细与费用 →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">各工具使用次数</CardTitle>
          <CardDescription>
            按主站 <code className="rounded bg-muted px-1 text-xs">ToolUsageEvent</code>{" "}
            汇总（当前库内各 <code className="rounded bg-muted px-1 text-xs">toolKey</code>{" "}
            流水条数）
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {toolUsageChartData.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 text-sm text-muted-foreground">
              暂无工具入账流水，生成扣费事件后将在此汇总。
            </div>
          ) : (
            <AdminToolUsageBarChart data={toolUsageChartData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
