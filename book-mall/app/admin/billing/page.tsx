import { prisma } from "@/lib/prisma";
import { formatPointsAsYuan } from "@/lib/currency";
import { createSubscriptionRefundRequest } from "@/app/actions/refunds";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformConfigForm } from "./platform-config-form";
import { ExtendSubscriptionForm } from "./extend-subscription-form";
import {
  SubscriptionPlanCard,
  type PlanRow,
} from "./subscription-plan-card";

export const metadata = {
  title: "订阅与计费 — 管理后台",
};

export default async function AdminBillingPage() {
  const [config, plans, planSubCounts, orders, rechargeAgg] = await Promise.all(
    [
      prisma.platformConfig.findUnique({ where: { id: "default" } }),
      prisma.subscriptionPlan.findMany({
        orderBy: [{ interval: "asc" }, { archivedAt: "asc" }, { id: "asc" }],
      }),
      prisma.subscription.groupBy({
        by: ["planId"],
        _count: { _all: true },
      }),
      prisma.order.findMany({
        take: 80,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } } },
      }),
      prisma.walletEntry.aggregate({
        where: { type: "RECHARGE" },
        _sum: { amountPoints: true },
      }),
    ],
  );

  if (!config) {
    return <p className="text-destructive text-sm">请先执行 pnpm db:seed</p>;
  }

  const totalRecharge = rechargeAgg._sum.amountPoints ?? 0;
  const subCountByPlan = new Map<string, number>();
  for (const row of planSubCounts) {
    subCountByPlan.set(row.planId, row._count._all);
  }

  const planRows: PlanRow[] = plans.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    interval: p.interval,
    pricePoints: p.pricePoints,
    active: p.active,
    archivedAt: p.archivedAt,
    parentPlanId: p.parentPlanId,
    toolsNavAllowlist: p.toolsNavAllowlist,
    subscriptionsCount: subCountByPlan.get(p.id) ?? 0,
  }));

  // 按 lineage 串：active plan 一行，沿 parentPlanId 上溯收集其所有祖先作为「历史版本」。
  const byId = new Map(planRows.map((p) => [p.id, p]));
  const collectAncestors = (start: PlanRow): PlanRow[] => {
    const out: PlanRow[] = [];
    let cur = start.parentPlanId ? byId.get(start.parentPlanId) : undefined;
    let safety = 50;
    while (cur && safety-- > 0) {
      out.push(cur);
      cur = cur.parentPlanId ? byId.get(cur.parentPlanId) : undefined;
    }
    return out;
  };

  const activePlans = planRows.filter((p) => p.active && !p.archivedAt);
  const orphanArchived = planRows.filter((p) => {
    if (p.active && !p.archivedAt) return false;
    // 已被某个 active plan 的链条覆盖到的旧版本不再单独列
    for (const a of activePlans) {
      if (collectAncestors(a).some((x) => x.id === p.id)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">订阅与充值管理（5.3）</h1>
        <p className="text-sm text-muted-foreground">
          计费配置、订阅套餐价格、订单查阅、手动续期与订阅提现审核入口；前台「第七章」细则见{" "}
          <a
            href="/pricing-disclosure"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            价格公示与使用说明
          </a>
          与首页计费摘要。
        </p>
        <p className="mt-2 text-sm tabular-nums">
          历史充值入账合计（流水 RECHARGE）：{" "}
          <span className="font-semibold">
            ¥{formatPointsAsYuan(totalRecharge)}
          </span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>计费配置</CardTitle>
          <CardDescription>
            最低余额线、预警线、LLM/工具参考单价（点，1 点 = ¥0.01）、异常消耗倍数（%）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformConfigForm
            config={{
              minBalanceLinePoints: config.minBalanceLinePoints,
              balanceWarnHighPoints: config.balanceWarnHighPoints,
              balanceWarnMidPoints: config.balanceWarnMidPoints,
              llmInputPer1kTokensPoints: config.llmInputPer1kTokensPoints,
              llmOutputPer1kTokensPoints: config.llmOutputPer1kTokensPoints,
              toolInvokePerCallPoints: config.toolInvokePerCallPoints,
              usageAnomalyRatioPercent: config.usageAnomalyRatioPercent,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>订阅套餐版本</CardTitle>
          <CardDescription>
            订阅价不可直接改，避免破坏老用户的订阅价溯源。如需调价，请发布新版本（旧版本将归档为 <code className="font-mono">{`${"<slug>"}__v${"<时间戳>"}`}</code>，老用户的 Subscription.planId 仍指向旧版本，可在「历史版本」中查询当时价）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {activePlans.map((p) => (
            <SubscriptionPlanCard
              key={p.id}
              active={p}
              history={collectAncestors(p)}
            />
          ))}
          {activePlans.length === 0 && (
            <p className="text-sm text-muted-foreground">
              当前没有 active 的订阅套餐，请先执行 <code>pnpm db:seed</code>。
            </p>
          )}
          {orphanArchived.length > 0 && (
            <details className="rounded-md border border-border/60 bg-muted/30">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50">
                未挂在当前链上的归档套餐（{orphanArchived.length}）
              </summary>
              <div className="overflow-x-auto px-3 pb-3 pt-2">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3">slug</th>
                      <th className="py-1 pr-3">名称</th>
                      <th className="py-1 pr-3">类型</th>
                      <th className="py-1 pr-3 tabular-nums">价</th>
                      <th className="py-1 pr-3">归档时间</th>
                      <th className="py-1 pr-3 tabular-nums">关联订阅</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanArchived.map((p) => (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="py-1 pr-3 font-mono text-[11px]">{p.slug}</td>
                        <td className="py-1 pr-3">{p.name}</td>
                        <td className="py-1 pr-3">
                          {p.interval === "YEAR" ? "年" : "月"}
                        </td>
                        <td className="py-1 pr-3 tabular-nums">
                          {p.pricePoints} 点
                        </td>
                        <td className="py-1 pr-3 text-muted-foreground">
                          {p.archivedAt
                            ? p.archivedAt.toLocaleString("zh-CN")
                            : "—"}
                        </td>
                        <td className="py-1 pr-3 tabular-nums">
                          {p.subscriptionsCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>手动续期订阅</CardTitle>
          <CardDescription>按用户邮箱延长当前有效订阅的结束日</CardDescription>
        </CardHeader>
        <CardContent>
          <ExtendSubscriptionForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>订单（最近 80 条）</CardTitle>
          <CardDescription>
            订阅提现：对「已支付且未标记提现完成」的订阅订单可创建审核单，在{" "}
            <a href="/admin/refunds" className="text-primary underline">
              提现审核
            </a>{" "}
            中处理。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-2">时间</th>
                <th className="p-2">用户</th>
                <th className="p-2">类型</th>
                <th className="p-2">状态</th>
                <th className="p-2">金额</th>
                <th className="p-2">提现</th>
                <th className="p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-secondary/60">
                  <td className="p-2 text-muted-foreground whitespace-nowrap">
                    {o.createdAt.toLocaleString("zh-CN")}
                  </td>
                  <td className="p-2">{o.user.email}</td>
                  <td className="p-2">{o.type}</td>
                  <td className="p-2">{o.status}</td>
                  <td className="p-2 tabular-nums">
                    ¥{formatPointsAsYuan(o.amountPoints)}
                  </td>
                  <td className="p-2">{o.refundedAt ? "已提" : "—"}</td>
                  <td className="p-2">
                    {o.type === "SUBSCRIPTION" &&
                    o.status === "PAID" &&
                    !o.refundedAt ? (
                      <form action={createSubscriptionRefundRequest}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <Button type="submit" size="sm" variant="outline">
                          发起提现审核
                        </Button>
                      </form>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
