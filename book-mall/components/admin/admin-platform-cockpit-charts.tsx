"use client";

import dynamic from "next/dynamic";
import type { PlatformCockpitSnapshot } from "@/lib/admin/platform-cockpit-service";
import { formatPointsAsYuan } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ChartLoading = () => (
  <div className="flex h-[260px] items-center justify-center text-sm text-[#656d76]">
    图表加载中…
  </div>
);

const AdminCockpitHorizontalBarChart = dynamic(
  () =>
    import("@/components/admin/admin-cockpit-charts").then(
      (m) => m.AdminCockpitHorizontalBarChart,
    ),
  { ssr: false, loading: ChartLoading },
);

const AdminCockpitVerticalBarChart = dynamic(
  () =>
    import("@/components/admin/admin-cockpit-charts").then(
      (m) => m.AdminCockpitVerticalBarChart,
    ),
  { ssr: false, loading: ChartLoading },
);

const AdminCockpitLineChart = dynamic(
  () => import("@/components/admin/admin-cockpit-charts").then((m) => m.AdminCockpitLineChart),
  { ssr: false, loading: ChartLoading },
);

function fmt(n: number) {
  return n.toLocaleString("zh-CN");
}

export function AdminPlatformCockpitCharts({ data }: { data: PlatformCockpitSnapshot }) {
  const trendTotal = data.charts.creditConsumptionTrend.reduce((s, d) => s + d.value, 0);

  return (
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
  );
}
