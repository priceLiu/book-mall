import { prisma } from "@/lib/prisma";
import { formatMinorAsYuan } from "@/lib/currency";
import {
  updatePlatformBillingConfig,
  updateSubscriptionPlanPrice,
  updateSubscriptionPlanToolsAllowlist,
  extendActiveSubscription,
} from "@/app/actions/billing";
import { createSubscriptionRefundRequest } from "@/app/actions/refunds";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";

export const metadata = {
  title: "订阅与计费 — 管理后台",
};

const SUITE_LABEL: Record<string, string> = {
  "fitting-room": "试衣间",
  "text-to-image": "文生图",
  "image-to-video": "图生视频",
  "smart-support": "AI智能客服",
  "app-history": "费用明细",
};

export default async function AdminBillingPage() {
  const [config, plans, orders, rechargeAgg] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { id: "default" } }),
    prisma.subscriptionPlan.findMany({ orderBy: { interval: "asc" } }),
    prisma.order.findMany({
      take: 80,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
    prisma.walletEntry.aggregate({
      where: { type: "RECHARGE" },
      _sum: { amountMinor: true },
    }),
  ]);

  if (!config) {
    return <p className="text-destructive text-sm">请先执行 pnpm db:seed</p>;
  }

  const totalRecharge = rechargeAgg._sum.amountMinor ?? 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">订阅与充值管理（5.3）</h1>
        <p className="text-sm text-muted-foreground">
          计费配置、订阅套餐价格、订单查阅、手动续期与订阅退款审核入口；可配置项同步满足{" "}
          <strong>第七章·运营公示</strong> 的前台文案数据来源。
        </p>
        <p className="mt-2 text-sm tabular-nums">
          历史充值入账合计（流水 RECHARGE）：{" "}
          <span className="font-semibold">¥{formatMinorAsYuan(totalRecharge)}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>计费配置</CardTitle>
          <CardDescription>
            最低余额线、预警线、LLM/工具参考单价（分）、异常消耗倍数（%）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePlatformBillingConfig} className="grid gap-4 sm:grid-cols-2">
            <Field label="最低余额线（分）" name="minBalanceLineMinor" defaultValue={config.minBalanceLineMinor} />
            <Field label="较高预警线（分）" name="balanceWarnHighMinor" defaultValue={config.balanceWarnHighMinor} />
            <Field label="中等预警线（分）" name="balanceWarnMidMinor" defaultValue={config.balanceWarnMidMinor} />
            <Field label="LLM 输入 / 千 token（分）" name="llmInputPer1kTokensMinor" defaultValue={config.llmInputPer1kTokensMinor} />
            <Field label="LLM 输出 / 千 token（分）" name="llmOutputPer1kTokensMinor" defaultValue={config.llmOutputPer1kTokensMinor} />
            <Field label="工具单次调用（分）" name="toolInvokePerCallMinor" defaultValue={config.toolInvokePerCallMinor} />
            <Field label="异常消耗倍数（%）" name="usageAnomalyRatioPercent" defaultValue={config.usageAnomalyRatioPercent} />
            <div className="sm:col-span-2">
              <Button type="submit">保存配置</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>订阅套餐价格</CardTitle>
          <CardDescription>月度/年度标价（分）；真实支付接入后可与订单联动</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {plans.map((plan) => (
            <div key={plan.id} className="space-y-5 border-b border-secondary/80 pb-8 last:border-0 last:pb-0">
              <form
                action={updateSubscriptionPlanPrice}
                className="flex flex-wrap items-end gap-4"
              >
                <input type="hidden" name="planId" value={plan.id} />
                <div>
                  <p className="text-sm font-medium">
                    {plan.name}{" "}
                    <span className="text-muted-foreground">({plan.slug})</span>
                  </p>
                  <Label className="text-xs text-muted-foreground">价格（分）</Label>
                  <Input
                    name="priceMinor"
                    type="number"
                    className="mt-1 w-40"
                    defaultValue={plan.priceMinor}
                    required
                    min={0}
                  />
                </div>
                <Button type="submit" size="sm" variant="secondary">
                  保存价格
                </Button>
              </form>

              <form action={updateSubscriptionPlanToolsAllowlist} className="space-y-3">
                <input type="hidden" name="planId" value={plan.id} />
                <p className="text-xs font-medium text-muted-foreground">
                  工具站套件（JWT / introspect <code className="font-mono">tools_nav_keys</code>）
                </p>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="toolsAllowMode"
                      value="all"
                      defaultChecked={plan.toolsNavAllowlist.length === 0}
                    />
                    <span>
                      订阅享有<strong>全部</strong>套件分组（白名单留空）
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="toolsAllowMode"
                      value="pick"
                      defaultChecked={plan.toolsNavAllowlist.length > 0}
                    />
                    <span>仅勾选的分组（自定义）</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {TOOL_SUITE_NAV_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="toolsNavKey"
                        value={key}
                        defaultChecked={plan.toolsNavAllowlist.includes(key)}
                      />
                      <span>{SUITE_LABEL[key] ?? key}</span>
                    </label>
                  ))}
                </div>
                <Button type="submit" size="sm" variant="outline">
                  保存套件范围
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>手动续期订阅</CardTitle>
          <CardDescription>按用户邮箱延长当前有效订阅的结束日</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={extendActiveSubscription} className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="sub-email">用户邮箱</Label>
              <Input id="sub-email" name="email" type="email" required className="w-64" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-days">延长天数</Label>
              <Input id="sub-days" name="days" type="number" min={1} max={3650} required className="w-32" defaultValue={30} />
            </div>
            <Button type="submit">续期</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>订单（最近 80 条）</CardTitle>
          <CardDescription>
            订阅退款：对「已支付且未标记退款」的订阅订单可创建审核单，在{" "}
            <a href="/admin/refunds" className="text-primary underline">
              退款审核
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
                <th className="p-2">退款</th>
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
                  <td className="p-2 tabular-nums">¥{formatMinorAsYuan(o.amountMinor)}</td>
                  <td className="p-2">{o.refundedAt ? "已退" : "—"}</td>
                  <td className="p-2">
                    {o.type === "SUBSCRIPTION" &&
                    o.status === "PAID" &&
                    !o.refundedAt ? (
                      <form action={createSubscriptionRefundRequest}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <Button type="submit" size="sm" variant="outline">
                          发起退款审核
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

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input name={name} type="number" required min={0} defaultValue={defaultValue} />
    </div>
  );
}
