"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type Alert = { code: string; level: string; message: string };
type Metrics = {
  blendedMargin: number | null;
  videoMargin: number | null;
  todayVideoCostYuan: number;
  yesterdayVideoCostYuan: number;
  dailyVideoCostMoMRate: number | null;
  lossRate: number | null;
};

function pct(n: number | null) {
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
}

const LEVEL: Record<string, string> = {
  WARN: "bg-[#fff7e6] text-[#d48806]",
  CRITICAL: "bg-[#fff1f0] text-[#cf1322]",
};

export function PnlAlertsClient() {
  const base = useBookMallBaseUrl();
  const [periodKey, setPeriodKey] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) return;
    const d = new Date();
    const pk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    setPeriodKey(pk);
    financeApiFetch<{ alerts: Alert[]; metrics: Metrics; periodKey: string }>(
      base,
      `/api/finance/pnl-alerts?period=${pk}`,
    ).then((r) => {
      if (r.ok) {
        setAlerts(r.data.alerts);
        setMetrics(r.data.metrics);
      } else {
        setError(r.error);
      }
    });
  }, [base]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!metrics) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-medium text-[#262626]">盈亏预警中心</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          财务 2.0 · 统计周期 {periodKey}（UTC）
        </p>
      </header>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">当前预警（{alerts.length}）</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-[#8c8c8c]">暂无预警，各项指标健康。</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.code}
                className="flex items-center justify-between rounded border border-[#f0f0f0] px-3 py-2 text-sm"
              >
                <span>{a.message}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${LEVEL[a.level] ?? ""}`}>{a.level}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">关键指标</h2>
        <table className="w-full text-sm">
          <tbody>
            <MetricRow label="综合毛利（阈值 75%）" value={pct(metrics.blendedMargin)} />
            <MetricRow label="视频毛利（阈值 70%）" value={pct(metrics.videoMargin)} />
            <MetricRow label="今日视频成本" value={`¥${metrics.todayVideoCostYuan.toFixed(2)}`} />
            <MetricRow label="昨日视频成本" value={`¥${metrics.yesterdayVideoCostYuan.toFixed(2)}`} />
            <MetricRow
              label="单日视频成本环比（阈值 +50%）"
              value={
                metrics.dailyVideoCostMoMRate == null
                  ? "—"
                  : `${metrics.dailyVideoCostMoMRate >= 0 ? "+" : ""}${(metrics.dailyVideoCostMoMRate * 100).toFixed(0)}%`
              }
            />
            <MetricRow label="积分损耗率（阈值 15%）" value={pct(metrics.lossRate)} />
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-[#f0f0f0]">
      <td className="py-2 text-[#8c8c8c]">{label}</td>
      <td className="py-2 text-right font-medium">{value}</td>
    </tr>
  );
}
