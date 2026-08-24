"use client";

import {
  AdminCockpitHorizontalBarChart,
  AdminCockpitLineChart,
  AdminCockpitMultiLineChart,
  AdminCockpitVerticalBarChart,
} from "@/components/admin/admin-cockpit-charts";
import type { PlatformCockpitMetricsSection } from "@/lib/admin/platform-cockpit-service";
import { formatPointsAsYuan } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function fmtYuan(n: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmt(n: number) {
  return n.toLocaleString("zh-CN");
}

export function AdminPlatformCockpitCharts({ data }: { data: PlatformCockpitMetricsSection }) {
  const trendTotal = data.charts.creditConsumptionTrend.reduce((s, d) => s + d.value, 0);
  const usage = data.modelUsage.monthTotals;
  const periodLabel = data.commerce.periodKey.replace("-", " 年 ") + " 月";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>当日新增注册</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-3xl">
              {fmt(data.users.newToday)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            CST 业务日 · 其中平台代付 {fmt(data.users.newTodayPlatformCredit)} 人
          </CardContent>
        </Card>
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>累计平台代付用户</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-3xl">
              {fmt(data.users.platformCredit)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            注册用户 {fmt(data.users.total)} · BYOK {fmt(data.users.byok)}
          </CardContent>
        </Card>
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{periodLabel}订阅</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-3xl">
              {fmt(data.commerce.membership.userCount)} 人
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            实收 {fmtYuan(data.commerce.membership.amountYuan)} ·{" "}
            {fmt(data.commerce.membership.orderCount)} 笔
          </CardContent>
        </Card>
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{periodLabel}积分充值</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-3xl">
              {fmtYuan(data.commerce.topup.amountYuan)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {fmt(data.commerce.topup.userCount)} 人 · {fmt(data.commerce.topup.orderCount)} 笔
          </CardContent>
        </Card>
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm sm:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>{periodLabel}模型成功调用</CardDescription>
            <CardTitle className="text-xl tabular-nums sm:text-2xl">
              图片 {fmt(usage.image)} · 视频 {fmt(usage.video)} · 其他 {fmt(usage.other)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            合计 {fmt(usage.total)} 次（Gateway SUCCEEDED · IMAGE/TRYON · VIDEO · 其余）
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">用户与身份</CardTitle>
          <CardDescription>
            注册 {fmt(data.users.total)} · 平台代付 {fmt(data.users.platformCredit)} · BYOK{" "}
            {fmt(data.users.byok)}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminCockpitHorizontalBarChart data={data.charts.userIdentity} />
        </CardContent>
      </Card>

      <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">积分与计费</CardTitle>
          <CardDescription>
            账户 {fmt(data.credits.accountCount)} 户 · 订阅刷新{" "}
            {fmt(data.credits.subscriptionAccounts)} 户 · 钱包约合 ¥
            {formatPointsAsYuan(data.walletLegacy.totalBalancePoints)}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminCockpitVerticalBarChart data={data.charts.creditsBilling} />
        </CardContent>
      </Card>

      <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">模型用量趋势</CardTitle>
          <CardDescription>
            {periodLabel} Gateway 成功调用（CST 日汇总）· 图片 {fmt(usage.image)} · 视频{" "}
            {fmt(usage.video)} · 其他 {fmt(usage.other)} · 合计 {fmt(usage.total)}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminCockpitMultiLineChart data={data.charts.modelUsageTrend} />
        </CardContent>
      </Card>

      <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">积分消耗趋势</CardTitle>
          <CardDescription>
            近 14 日 CONSUME + SETTLE 日汇总（CST）· 区间合计 {fmt(trendTotal)} 点 · 今日{" "}
            {fmt(data.credits.consumedToday)} 点
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminCockpitLineChart data={data.charts.creditConsumptionTrend} />
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
