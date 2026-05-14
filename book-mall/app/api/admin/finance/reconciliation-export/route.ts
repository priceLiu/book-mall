import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { WalletEntryType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPointsAsYuan } from "@/lib/currency";
import { aggregateWalletTopupOrdersBreakdown } from "@/lib/wallet-topup-fulfill";

export const dynamic = "force-dynamic";

function csvEscape(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells: string[]): string {
  return cells.map(csvEscape).join(",") + "\r\n";
}

/** 财务核对快照 CSV（UTF-8 BOM，便于 Excel） */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const generatedAt = new Date().toISOString();

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
  const delta = usageSum - consumeAbs;

  let body = "\ufeff";
  body += row(["section", "metric", "points", "yuan_or_note"]);
  body += row([
    "summary",
    "generatedAt_utc",
    "",
    generatedAt,
  ]);
  body += row(["summary", "recharge_sum_points", String(rechargeSum), formatPointsAsYuan(rechargeSum)]);
  body += row(["summary", "recharge_count", String(rechargeAgg._count), ""]);
  body += row(["summary", "consume_sum_points_signed", String(consumeSum), "通常为负"]);
  body += row(["summary", "consume_abs_points", String(consumeAbs), formatPointsAsYuan(consumeAbs)]);
  body += row(["summary", "consume_count", String(consumeAgg._count), ""]);
  body += row(["summary", "usage_cost_sum_points", String(usageSum), formatPointsAsYuan(usageSum)]);
  body += row(["summary", "usage_with_cost_count", String(usageCounted), ""]);
  body += row(["summary", "usage_without_cost_count", String(usageNullCost), ""]);
  body += row(["summary", "usage_minus_consume_abs_points", String(delta), "应接近0"]);
  body += row([
    "summary",
    "refund_sum_points",
    String(refundAgg._sum.amountPoints ?? 0),
    "",
  ]);
  body += row(["summary", "refund_count", String(refundAgg._count), ""]);
  body += row([
    "summary",
    "adjust_sum_points",
    String(adjustAgg._sum.amountPoints ?? 0),
    "",
  ]);
  body += row(["summary", "adjust_count", String(adjustAgg._count), ""]);
  body += row([
    "summary",
    "wallet_balance_sum_points",
    String(walletAgg._sum.balancePoints ?? 0),
    formatPointsAsYuan(walletAgg._sum.balancePoints ?? 0),
  ]);
  body += row(["summary", "wallet_count", String(walletAgg._count), ""]);
  body += row([
    "summary",
    "paid_orders_sum_points",
    String(paidOrdersAgg._sum.amountPoints ?? 0),
    formatPointsAsYuan(paidOrdersAgg._sum.amountPoints ?? 0),
  ]);
  body += row(["summary", "paid_orders_count", String(paidOrdersAgg._count), ""]);

  body += row([
    "topup_orders",
    "wallet_topup_paid_sum_points",
    String(topupBreakdown.paidPoints),
    formatPointsAsYuan(topupBreakdown.paidPoints),
  ]);
  body += row([
    "topup_orders",
    "wallet_topup_bonus_sum_points",
    String(topupBreakdown.bonusPoints),
    formatPointsAsYuan(topupBreakdown.bonusPoints),
  ]);
  body += row([
    "topup_orders",
    "wallet_topup_credited_sum_points",
    String(topupBreakdown.creditedTotalPoints),
    formatPointsAsYuan(topupBreakdown.creditedTotalPoints),
  ]);
  body += row([
    "topup_orders",
    "wallet_topup_paid_order_count",
    String(topupBreakdown.orderCount),
    "",
  ]);
  body += row([
    "topup_orders",
    "wallet_topup_orders_missing_topup_meta",
    String(topupBreakdown.ordersWithoutTopupMeta),
    "legacy_full_amount_as_paid",
  ]);

  body += row(["tool_usage", "toolKey", "cost_sum_points", "yuan"]);
  const toolRows = [...toolByKey].sort(
    (a, b) => (b._sum.costPoints ?? 0) - (a._sum.costPoints ?? 0),
  );
  for (const r of toolRows) {
    const pts = r._sum.costPoints ?? 0;
    body += row(["tool_usage", r.toolKey, String(pts), formatPointsAsYuan(pts)]);
  }

  const date = generatedAt.slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-reconciliation-${date}.csv"`,
    },
  });
}