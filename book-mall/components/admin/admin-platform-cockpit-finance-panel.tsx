"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { CockpitFinanceKpis } from "@/lib/admin/platform-cockpit-finance-kpis";
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

function fmtPct(rate: number | null) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function KpiCard({
  label,
  value,
  hint,
  href,
  hrefLabel,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  accent?: "cost" | "revenue" | "profit";
}) {
  const accentCls =
    accent === "cost"
      ? "text-[#cf1322]"
      : accent === "revenue"
        ? "text-[#0969da]"
        : accent === "profit"
          ? "text-[#389e0d]"
          : "";
  return (
    <Card className="flex h-full flex-col border-[#d1d9e0]/80 bg-white/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums tracking-tight sm:text-3xl ${accentCls}`}>
          {value}
        </CardTitle>
      </CardHeader>
      {(hint || href) && (
        <CardContent className="mt-auto pt-0 text-xs text-muted-foreground">
          {hint ? <p className="min-h-[2.5rem] leading-snug">{hint}</p> : null}
          {href ? (
            <Link
              href={href}
              className="mt-auto block pt-2 font-medium text-[#0969da] underline-offset-4 hover:underline"
            >
              {hrefLabel ?? "查看详情 →"}
            </Link>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AdminPlatformCockpitFinancePanel({
  initialFinance,
}: {
  initialFinance: CockpitFinanceKpis;
}) {
  const [finance, setFinance] = useState(initialFinance);
  const [periodKey, setPeriodKey] = useState(initialFinance.periodKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = periodKey === currentPeriodKey();
  const periodLabel = finance.periodKey.replace("-", " 年 ") + " 月";

  const refresh = useCallback(async (nextPeriod?: string) => {
    const pk = nextPeriod ?? periodKey;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ periodKey: pk });
      const res = await fetch(`/api/admin/platform-cockpit/finance?${qs}`);
      const body = (await res.json()) as { finance?: CockpitFinanceKpis; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `加载失败 (${res.status})`);
      }
      if (!body.finance) throw new Error("响应缺少 finance");
      setFinance(body.finance);
      setPeriodKey(body.finance.periodKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [periodKey]);

  function onPeriodChange(value: string) {
    setPeriodKey(value);
    void refresh(value);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1f2328]">
            {isCurrentMonth ? "本月" : ""}经营概览
          </h2>
          <p className="mt-0.5 text-sm text-[#656d76]">
            {periodLabel} · 平台代付 · 净成本口径（含渠道折扣快照）
            {finance.truncated
              ? ` · 厂商分组基于最近 ${finance.scannedCalls} 条调用（共 ${finance.succeededCalls} 条）`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[#656d76]">
            <span className="sr-only">账期</span>
            <input
              type="month"
              value={periodKey}
              disabled={loading}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="rounded-md border border-[#d1d9e0] bg-white px-2 py-1.5 text-sm text-[#1f2328] disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-sm font-medium text-[#1f2328] hover:border-[#0969da] disabled:opacity-60"
          >
            {loading ? "刷新中…" : "刷新"}
          </button>
          <Link
            href="/admin/finance/pnl-report"
            className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-sm font-medium text-[#1f2328] hover:border-[#0969da]"
          >
            P&amp;L 报表
          </Link>
          <Link
            href="/admin/finance/reconciliation"
            className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-sm font-medium text-[#1f2328] hover:border-[#0969da]"
          >
            对账总账
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">
          {error}
        </p>
      ) : null}

      <div
        className={`grid gap-4 sm:grid-cols-3 ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
        <KpiCard
          label="应付厂商（净成本）"
          value={fmtYuan(finance.vendorCostYuan)}
          hint="Gateway 成功调用 × 成本快照单价"
          href="/admin/finance/reconciliation"
          hrefLabel="厂商对账 →"
          accent="cost"
        />
        <KpiCard
          label="用户侧实收"
          value={fmtYuan(finance.platformRevenueYuan)}
          hint={`消耗 ${finance.consumeCredits.toLocaleString("zh-CN")} 积分 × 用户单价`}
          href="/admin/finance/usage-overview"
          hrefLabel="费用概览 →"
          accent="revenue"
        />
        <KpiCard
          label="毛利"
          value={fmtYuan(finance.profitYuan)}
          hint={`毛利率 ${fmtPct(finance.marginRate)}`}
          href="/admin/finance/pnl-report"
          hrefLabel="P&L 明细 →"
          accent="profit"
        />
      </div>

      {finance.byVendor.length > 0 ? (
        <div
          className={`overflow-x-auto rounded-lg border border-[#d1d9e0] bg-white ${loading ? "opacity-60" : ""}`}
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[#f6f8fa] text-left text-xs text-[#656d76]">
              <tr>
                <th className="px-3 py-2 font-medium">厂商</th>
                <th className="px-3 py-2 text-right font-medium">应付（净成本）</th>
                <th className="px-3 py-2 text-right font-medium">用户实收</th>
                <th className="px-3 py-2 text-right font-medium">毛利</th>
                <th className="px-3 py-2 text-right font-medium">调用</th>
                <th className="px-3 py-2 text-right font-medium">积分</th>
              </tr>
            </thead>
            <tbody>
              {finance.byVendor.map((v) => (
                <tr key={v.vendorKey} className="border-t border-[#eaeef2]">
                  <td className="px-3 py-2 font-medium text-[#1f2328]">{v.vendorLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#cf1322]">
                    {fmtYuan(v.costYuan)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#0969da]">
                    {fmtYuan(v.revenueYuan)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      v.profitYuan >= 0 ? "text-[#389e0d]" : "text-[#cf1322]"
                    }`}
                  >
                    {fmtYuan(v.profitYuan)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#656d76]">
                    {v.callCount.toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#656d76]">
                    {v.consumeCredits.toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#d1d9e0] bg-[#f6f8fa] px-4 py-6 text-center text-sm text-[#656d76]">
          {isCurrentMonth ? "本月" : periodLabel}暂无平台代付成功调用，或尚未产生扣积分记录。
        </p>
      )}
    </section>
  );
}
