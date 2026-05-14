import Link from "next/link";
import { WalletEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPointsAsYuan } from "@/lib/currency";
import { aggregateWalletTopupOrdersBreakdown } from "@/lib/wallet-topup-fulfill";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "财务核对 — 管理后台",
};

function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN");
}

export default async function AdminFinanceReconciliationPage() {
  const [
    rechargeAgg,
    consumeAgg,
    refundAgg,
    adjustAgg,
    usageCostAgg,
    usageCounted,
    usageNullCost,
    walletAgg,
    paidOrdersAgg,
    toolByKey,
    topupBreakdown,
  ] = await Promise.all([
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.RECHARGE },
      _sum: { amountPoints: true },
      _count: true,
    }),
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.CONSUME },
      _sum: { amountPoints: true },
      _count: true,
    }),
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.REFUND },
      _sum: { amountPoints: true },
      _count: true,
    }),
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.ADJUST },
      _sum: { amountPoints: true },
      _count: true,
    }),
    prisma.toolUsageEvent.aggregate({
      where: { costPoints: { not: null } },
      _sum: { costPoints: true },
    }),
    prisma.toolUsageEvent.count({ where: { costPoints: { not: null } } }),
    prisma.toolUsageEvent.count({ where: { costPoints: null } }),
    prisma.wallet.aggregate({
      _sum: { balancePoints: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { amountPoints: true },
      _count: true,
    }),
    prisma.toolUsageEvent.groupBy({
      by: ["toolKey"],
      where: { costPoints: { not: null } },
      _sum: { costPoints: true },
    }),
    aggregateWalletTopupOrdersBreakdown(),
  ]);

  const rechargeSum = rechargeAgg._sum.amountPoints ?? 0;
  const consumeSum = consumeAgg._sum.amountPoints ?? 0;
  const consumeAbs = Math.abs(consumeSum);
  const usageSum = usageCostAgg._sum.costPoints ?? 0;
  const usageVsConsumeDelta = usageSum - consumeAbs;
  const topupVsRechargeDelta = topupBreakdown.creditedTotalPoints - rechargeSum;

  const toolRows = [...toolByKey].sort(
    (a, b) => (b._sum.costPoints ?? 0) - (a._sum.costPoints ?? 0),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">财务核对</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-prose">
            汇总钱包流水、用量扣费与订单口径，便于与内部账务或支付渠道对账。
            <strong className="text-foreground"> 用量事件扣费合计</strong>与
            <strong className="text-foreground"> 消耗类钱包分录（绝对值）</strong>
            在统一走「上报即扣款」路径时应接近；存在手工调账、历史迁移或未入账用量时会偏差。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/api/admin/finance/reconciliation-export" target="_blank" rel="noopener noreferrer">
              下载 CSV 快照
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin">← 概览</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="充值入账（RECHARGE）"
          primary={`${num(rechargeSum)} 点`}
          sub={`¥${formatPointsAsYuan(rechargeSum)} · ${num(rechargeAgg._count)} 条`}
          href="/admin/finance/recharges"
          linkLabel="充值明细"
        />
        <MetricCard
          title="钱包消耗流水（CONSUME）"
          primary={`${num(consumeAbs)} 点`}
          sub={`分录合计 ${num(consumeSum)} 点（通常为负）· ${num(consumeAgg._count)} 条`}
          href="/admin/tool-usage"
          linkLabel="工具使用明细"
        />
        <MetricCard
          title="用量事件 · 有扣费"
          primary={`${num(usageSum)} 点`}
          sub={`¥${formatPointsAsYuan(usageSum)} · ${num(usageCounted)} 条 · 无扣费记录 ${num(usageNullCost)} 条`}
          href="/admin/tool-usage"
          linkLabel="工具使用明细"
        />
        <MetricCard
          title="用量 − 消耗流水（绝对值）"
          primary={`${num(usageVsConsumeDelta)} 点`}
          sub={
            usageVsConsumeDelta === 0
              ? "当前口径一致"
              : "存在差异时请核对未完成结算、重复幂等或历史数据"
          }
        />
        <MetricCard
          title="提现 / 调账（REFUND / ADJUST）"
          primary={`${num(refundAgg._sum.amountPoints ?? 0)} / ${num(adjustAgg._sum.amountPoints ?? 0)} 点`}
          sub={`REFUND ${num(refundAgg._count)} 条 · ADJUST ${num(adjustAgg._count)} 条`}
          href="/admin/refunds"
          linkLabel="提现审核"
        />
        <MetricCard
          title="已支付订单金额累计"
          primary={`${num(paidOrdersAgg._sum.amountPoints ?? 0)} 点`}
          sub={`¥${formatPointsAsYuan(paidOrdersAgg._sum.amountPoints ?? 0)} · ${num(paidOrdersAgg._count)} 笔`}
          href="/admin/billing"
          linkLabel="订阅与充值"
        />
        <MetricCard
          title="全站钱包余额合计"
          primary={`${num(walletAgg._sum.balancePoints ?? 0)} 点`}
          sub={`¥${formatPointsAsYuan(walletAgg._sum.balancePoints ?? 0)} · ${num(walletAgg._count)} 个钱包`}
        />
        <MetricCard
          title="充值订单 · 实收点（本金）"
          primary={`${num(topupBreakdown.paidPoints)} 点`}
          sub={`¥${formatPointsAsYuan(topupBreakdown.paidPoints)} · 已付 WALLET_TOPUP ${num(topupBreakdown.orderCount)} 笔 · 无 meta.topup 老单 ${num(topupBreakdown.ordersWithoutTopupMeta)} 笔（本息金计入实收）`}
          href="/admin/billing"
          linkLabel="订阅与充值"
        />
        <MetricCard
          title="充值订单 · 赠送点（活动）"
          primary={`${num(topupBreakdown.bonusPoints)} 点`}
          sub={`¥${formatPointsAsYuan(topupBreakdown.bonusPoints)} · 营销负债；与实收对账请用左栏`}
        />
        <MetricCard
          title="充值订单 · 到账合计（本+赠）"
          primary={`${num(topupBreakdown.creditedTotalPoints)} 点`}
          sub={`应≈左侧「充值入账」流水合计；差 ${num(topupVsRechargeDelta)} 点（非零时可能有非订单入账或历史数据）`}
        />
      </div>

      <div className="rounded-lg border border-secondary bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">说明：</strong>
          「实收点 / 赠送点」来自已支付 <code className="text-xs">WALLET_TOPUP</code> 订单的{" "}
          <code className="text-xs">meta.topup</code>；老订单无该字段时全额记入实收。全站{" "}
          <code className="text-xs">Order</code> 金额累计仍含订阅等，若要对账人民币实收请以支付渠道为准。
        </p>
      </div>

      <div className="rounded-lg border border-secondary">
        <div className="border-b border-secondary bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold">按工具汇总 · 用量扣费（点）</h2>
          <p className="text-xs text-muted-foreground mt-1">
            仅统计 <code className="text-xs">costPoints</code> 非空的用量事件。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-secondary bg-muted/30">
              <tr>
                <th className="p-3 font-medium">toolKey</th>
                <th className="p-3 font-medium text-right">扣费合计（点）</th>
                <th className="p-3 font-medium text-right">约合人民币</th>
              </tr>
            </thead>
            <tbody>
              {toolRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-3 text-muted-foreground">
                    暂无扣费用量。
                  </td>
                </tr>
              ) : (
                toolRows.map((r) => {
                  const pts = r._sum.costPoints ?? 0;
                  return (
                    <tr key={r.toolKey} className="border-b border-secondary/70 last:border-0">
                      <td className="p-3 font-mono text-xs">{r.toolKey}</td>
                      <td className="p-3 text-right tabular-nums">{num(pts)}</td>
                      <td className="p-3 text-right tabular-nums">¥{formatPointsAsYuan(pts)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-secondary pt-6">
        对外标价以{" "}
        <Link href="/pricing-disclosure" className="text-primary underline" target="_blank" rel="noopener noreferrer">
          前台价格公示
        </Link>{" "}
        为准；本页仅供内部运营对账，不构成对外报价承诺。
      </p>
    </div>
  );
}

function MetricCard({
  title,
  primary,
  sub,
  href,
  linkLabel,
}: {
  title: string;
  primary: string;
  sub: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-secondary bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight">{primary}</p>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{sub}</p>
      {href && linkLabel ? (
        <p className="mt-3">
          <Link href={href} className="text-xs text-primary underline font-medium">
            {linkLabel} →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
