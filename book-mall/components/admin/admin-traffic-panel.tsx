"use client";

import Link from "next/link";
import { AdminCockpitLineChart } from "@/components/admin/admin-cockpit-charts";
import type { TrafficDashboardSnapshot } from "@/lib/site-traffic/queries";
import {
  PLATFORM_TRAFFIC_APP_KEYS,
  PLATFORM_TRAFFIC_APP_LABELS,
  type PlatformTrafficAppKey,
} from "@/lib/site-traffic/app-keys";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function fmt(n: number) {
  return n.toLocaleString("zh-CN");
}

function pctChange(today: number, prev: number): string {
  if (prev === 0) return today > 0 ? "+100%" : "—";
  const p = Math.round(((today - prev) / prev) * 100);
  return p >= 0 ? `+${p}%` : `${p}%`;
}

function buildQuery(date: string, app: string) {
  const q = new URLSearchParams();
  if (date) q.set("date", date);
  if (app && app !== "all") q.set("app", app);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function AdminTrafficPanel({
  data,
  selectedApp,
}: {
  data: TrafficDashboardSnapshot;
  selectedApp: PlatformTrafficAppKey | "all";
}) {
  const trendPv = data.trend.map((t) => ({ date: t.date, value: t.pv }));
  const trendUv = data.trend.map((t) => ({ date: t.date, value: t.uv }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d1d9e0] pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#656d76]">Book 运营</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1f2328] sm:text-3xl">
            访问统计
          </h1>
          <p className="mt-2 text-sm text-[#656d76]">
            业务日 {data.selectedDateCst}（CST）· 快照{" "}
            {new Date(data.generatedAt).toLocaleString("zh-CN")}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", ...PLATFORM_TRAFFIC_APP_KEYS] as const).map((key) => {
          const active = selectedApp === key;
          const label = key === "all" ? "全站" : PLATFORM_TRAFFIC_APP_LABELS[key];
          return (
            <Link
              key={key}
              href={`/admin/traffic${buildQuery(data.selectedDateCst, key)}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                active
                  ? "border-[#0969da] bg-[#0969da] text-white"
                  : "border-[#d1d9e0] bg-white text-[#1f2328] hover:border-[#0969da]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>当日 PV</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{fmt(data.totals.pageViews)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            较昨日 {pctChange(data.totals.pageViews, data.totals.pageViewsCompare)}（
            {fmt(data.totals.pageViewsCompare)}）
          </CardContent>
        </Card>
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>当日 UV（IP 去重）</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{fmt(data.totals.uniqueIps)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            较昨日 {pctChange(data.totals.uniqueIps, data.totals.uniqueIpsCompare)}（
            {fmt(data.totals.uniqueIpsCompare)}）
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">14 天 PV 趋势</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AdminCockpitLineChart data={trendPv} />
          </CardContent>
        </Card>
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">14 天 UV 趋势</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AdminCockpitLineChart data={trendUv} />
          </CardContent>
        </Card>
      </div>

      {selectedApp === "all" && data.byApp.length > 0 ? (
        <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">按应用拆分（{data.selectedDateCst}）</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-[#656d76]">
                  <th className="pb-2 pr-4 font-medium">应用</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">PV</th>
                  <th className="pb-2 font-medium tabular-nums">UV</th>
                </tr>
              </thead>
              <tbody>
                {data.byApp.map((row) => (
                  <tr key={row.appKey} className="border-b border-[#d1d9e0]/60">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/traffic${buildQuery(data.selectedDateCst, row.appKey)}`}
                        className="font-medium text-[#0969da] hover:underline"
                      >
                        {row.label}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{fmt(row.pageViews)}</td>
                    <td className="py-2 tabular-nums">{fmt(row.uniqueIps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#d1d9e0]/80 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">IP Top 50</CardTitle>
          <CardDescription>
            {selectedApp === "all" ? "全站" : PLATFORM_TRAFFIC_APP_LABELS[selectedApp]} ·{" "}
            {data.selectedDateCst}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          {data.topIps.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-[#656d76]">
                  {selectedApp === "all" ? (
                    <th className="pb-2 pr-4 font-medium">应用</th>
                  ) : null}
                  <th className="pb-2 pr-4 font-medium">IP</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">次数</th>
                  <th className="pb-2 pr-4 font-medium">首次</th>
                  <th className="pb-2 pr-4 font-medium">末次</th>
                  <th className="pb-2 font-medium">用户 ID</th>
                </tr>
              </thead>
              <tbody>
                {data.topIps.map((row) => (
                  <tr key={`${row.appKey}-${row.ip}`} className="border-b border-[#d1d9e0]/60">
                    {selectedApp === "all" ? (
                      <td className="py-2 pr-4 text-xs">{PLATFORM_TRAFFIC_APP_LABELS[row.appKey as PlatformTrafficAppKey] ?? row.appKey}</td>
                    ) : null}
                    <td className="py-2 pr-4 font-mono text-xs">{row.ip}</td>
                    <td className="py-2 pr-4 tabular-nums">{fmt(row.hitCount)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-xs text-[#656d76]">
                      {new Date(row.firstSeenAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-xs text-[#656d76]">
                      {new Date(row.lastSeenAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="py-2 max-w-[9rem] truncate font-mono text-xs text-[#656d76]" title={row.userId ?? undefined}>
                      {row.userId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
