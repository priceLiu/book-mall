import Link from "next/link";
import dynamic from "next/dynamic";
import { WalletEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMinorAsYuan } from "@/lib/currency";
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
    prisma.wallet.aggregate({ _sum: { balanceMinor: true } }),
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.RECHARGE },
      _sum: { amountMinor: true },
    }),
    prisma.walletEntry.count({
      where: { type: WalletEntryType.RECHARGE },
    }),
    prisma.toolUsageEvent.groupBy({
      by: ["toolKey"],
      _count: { id: true },
    }),
  ]);

  const totalBalance = balanceSum._sum.balanceMinor ?? 0;
  const totalRecharge = rechargeSum._sum.amountMinor ?? 0;

  const toolUsageChartData = [...toolUsageGroups]
    .sort((a, b) => b._count.id - a._count.id)
    .map((g) => ({
      label: toolKeyToLabel(g.toolKey),
      count: g._count.id,
    }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">概览</h1>
        <p className="text-sm text-muted-foreground">
          用户、订阅与资金汇总；充值与工具消耗明细见对应入口。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>注册用户</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{userCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>有效订阅</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{activeSubscriptions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总充值金额（CNY）</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              ¥{formatMinorAsYuan(totalRecharge)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
            <p>历史累计入账「充值」类型之和</p>
            <Link
              href="/admin/finance/recharges"
              className="inline-block font-medium text-primary underline-offset-4 hover:underline"
            >
              查看充值明细 →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>充值笔数</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{rechargeTxCount}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
            <p>
              钱包流水类型为「充值」的分录条数（入账次数口径）
            </p>
            <Link
              href="/admin/finance/recharges"
              className="inline-block font-medium text-primary underline-offset-4 hover:underline"
            >
              充值明细 →
            </Link>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>全站剩余金额（CNY）</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              ¥{formatMinorAsYuan(totalBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
            <p>各用户钱包可用余额之和</p>
            <Link
              href="/admin/tool-usage"
              className="inline-block font-medium text-primary underline-offset-4 hover:underline"
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
