"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";

type GatewayDailyRow = {
  day: string;
  dimension: string;
  dimensionKey: string;
  dimensionLabel: string;
  requestCount: number;
  failedCount: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostYuan: number;
};

type DailyCompareRow = {
  day: string;
  channelKey: string;
  vendorRequests: number;
  gatewayRequests: number;
  requestDiff: number;
  vendorCostYuan: number;
  gatewayCostYuan: number;
  costDiffYuan: number;
  status: string;
  issueReason: string | null;
};

type UsageSummary = {
  gatewayRequestCount: number;
  gatewayFailedCount: number;
  gatewayEstimatedCostYuan: number;
  vendorRequestCount: number;
  vendorCostYuan: number;
  missingPlatformDays: number;
  alertCount: number;
};

type GatewayPayload = {
  period: { from: string; to: string };
  summary: UsageSummary;
  platformByApp: GatewayDailyRow[];
  byCredential: GatewayDailyRow[];
  byModel: GatewayDailyRow[];
};

type ComparePayload = GatewayPayload & {
  vendorDaily: unknown[];
  dailyCompare: DailyCompareRow[];
  alerts: DailyCompareRow[];
};

const inputCls =
  "rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "OK":
      return "bg-[#f6ffed] text-[#389e0d]";
    case "MISSING_PLATFORM":
      return "bg-[#fff1f0] text-[#cf1322]";
    case "MISSING_VENDOR":
      return "bg-[#fff7e6] text-[#d46b08]";
    case "OVER_PLATFORM":
    case "UNDER_PLATFORM":
      return "bg-[#fffbe6] text-[#d48806]";
    default:
      return "bg-[#fafafa] text-[#595959]";
  }
}

function SummaryCards({ summary }: { summary: UsageSummary }) {
  const cards = [
    { label: "Gateway 成功请求", value: summary.gatewayRequestCount.toLocaleString() },
    { label: "Gateway 失败", value: summary.gatewayFailedCount.toLocaleString() },
    {
      label: "Gateway 估算成本",
      value: `¥${summary.gatewayEstimatedCostYuan.toFixed(2)}`,
    },
    {
      label: "厂商请求（CSV）",
      value: summary.vendorRequestCount > 0 ? summary.vendorRequestCount.toLocaleString() : "—",
    },
    {
      label: "厂商成本（CSV）",
      value: summary.vendorCostYuan > 0 ? `¥${summary.vendorCostYuan.toFixed(2)}` : "—",
    },
    {
      label: "差异告警",
      value: summary.alertCount > 0 ? `${summary.alertCount} 条` : "无",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded border border-[#e8e8e8] bg-white px-3 py-2">
          <div className="text-xs text-[#8c8c8c]">{c.label}</div>
          <div className="mt-1 text-base font-medium">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function GatewayTable({
  title,
  rows,
  showDay = false,
}: {
  title: string;
  rows: GatewayDailyRow[];
  showDay?: boolean;
}) {
  const totalReq = rows.reduce((s, r) => s + r.requestCount, 0);
  return (
    <section className="rounded border border-[#e8e8e8] bg-white">
      <header className="border-b bg-[#fafafa] px-3 py-2 text-sm font-medium">
        {title}{" "}
        <span className="text-xs font-normal text-[#8c8c8c]">
          {totalReq.toLocaleString()} 次 · {rows.length} 项
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
              {showDay ? <th className="px-3 py-2">日期</th> : null}
              <th className="px-3 py-2">维度</th>
              <th className="px-3 py-2 text-right">请求</th>
              <th className="px-3 py-2 text-right">失败</th>
              <th className="px-3 py-2 text-right">Prompt</th>
              <th className="px-3 py-2 text-right">Completion</th>
              <th className="px-3 py-2 text-right">估算成本</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.day}-${r.dimensionKey}`} className="border-b last:border-0">
                {showDay ? <td className="px-3 py-1.5">{r.day || "—"}</td> : null}
                <td className="max-w-xs truncate px-3 py-1.5" title={r.dimensionLabel}>
                  {r.dimensionLabel || r.dimensionKey}
                </td>
                <td className="px-3 py-1.5 text-right">{r.requestCount}</td>
                <td className="px-3 py-1.5 text-right text-[#8c8c8c]">{r.failedCount || "—"}</td>
                <td className="px-3 py-1.5 text-right text-[#8c8c8c]">
                  {r.promptTokens.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right text-[#8c8c8c]">
                  {r.completionTokens.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right">¥{r.estimatedCostYuan.toFixed(4)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showDay ? 7 : 6} className="px-3 py-6 text-center text-[#8c8c8c]">
                  无数据
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompareTable({ rows }: { rows: DailyCompareRow[] }) {
  return (
    <section className="rounded border border-[#e8e8e8] bg-white">
      <header className="border-b bg-[#fafafa] px-3 py-2 text-sm font-medium">
        日对账明细 <span className="text-xs font-normal text-[#8c8c8c]">{rows.length} 行</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
              <th className="px-3 py-2">日期</th>
              <th className="px-3 py-2">Key / Channel</th>
              <th className="px-3 py-2 text-right">厂商请求</th>
              <th className="px-3 py-2 text-right">Gateway</th>
              <th className="px-3 py-2 text-right">请求差</th>
              <th className="px-3 py-2 text-right">厂商 ¥</th>
              <th className="px-3 py-2 text-right">Gateway ¥</th>
              <th className="px-3 py-2 text-right">成本差</th>
              <th className="px-3 py-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.day}-${r.channelKey}`}
                className={`border-b last:border-0 ${r.status === "MISSING_PLATFORM" ? "bg-[#fff1f0]" : ""}`}
              >
                <td className="px-3 py-1.5">{r.day}</td>
                <td className="px-3 py-1.5">{r.channelKey}</td>
                <td className="px-3 py-1.5 text-right">{r.vendorRequests}</td>
                <td className="px-3 py-1.5 text-right">{r.gatewayRequests}</td>
                <td
                  className={`px-3 py-1.5 text-right ${r.requestDiff !== 0 ? "font-medium text-[#cf1322]" : ""}`}
                >
                  {r.requestDiff > 0 ? `+${r.requestDiff}` : r.requestDiff}
                </td>
                <td className="px-3 py-1.5 text-right">¥{r.vendorCostYuan.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">¥{r.gatewayCostYuan.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">¥{r.costDiffYuan.toFixed(2)}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs ${statusBadgeClass(r.status)}`}
                    title={r.issueReason ?? undefined}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-[#8c8c8c]">
                  上传 DeepSeek CSV 后显示对账结果
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function UsageManagementClient() {
  const base = useBookMallBaseUrl();
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(defaultToDate);
  const [tab, setTab] = useState<"app" | "key" | "reconcile" | "alerts">("app");
  const [data, setData] = useState<GatewayPayload | ComparePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [amountFile, setAmountFile] = useState<File | null>(null);

  const loadGateway = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const qs = new URLSearchParams({ from, to });
    const r = await financeApiFetch<GatewayPayload>(
      base,
      `/api/finance/admin/usage-management?${qs}`,
    );
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base, from, to]);

  useEffect(() => {
    loadGateway();
  }, [loadGateway]);

  const uploadCompare = async () => {
    if (!base || (!costFile && !amountFile)) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.set("from", from);
    form.set("to", to);
    if (costFile) form.set("costCsv", costFile);
    if (amountFile) form.set("amountCsv", amountFile);
    const { url, init } = await import("@/lib/book-mall-client-request").then((m) =>
      m.resolveBookMallBrowserRequest(base, "/api/finance/admin/usage-management", {
        method: "POST",
        body: form,
      }),
    );
    const res = await fetch(url, init);
    const j = (await res.json()) as ComparePayload & { error?: string };
    if (!res.ok) {
      setError(j.error ?? `HTTP ${res.status}`);
    } else {
      setData(j);
      setTab("reconcile");
    }
    setUploading(false);
  };

  const alerts = useMemo(
    () => (data && "alerts" in data ? data.alerts : []),
    [data],
  );
  const dailyCompare = useMemo(
    () => (data && "dailyCompare" in data ? data.dailyCompare : []),
    [data],
  );

  if (!base) return <FinancePageState>等待 Book 站点地址…</FinancePageState>;
  if (error && !data) return <FinancePageState variant="error">{error}</FinancePageState>;

  return (
    <FinancePageShell>
      <header>
        <h1 className="text-lg font-medium">用量对账中心</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          GatewayRequestLog 日聚合 vs DeepSeek 厂商 CSV。平台业务用量与 Gateway 技术计数同源。
        </p>
      </header>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-[#8c8c8c]">起始日</span>
            <input
              type="date"
              className={`${inputCls} block`}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">结束日</span>
            <input
              type="date"
              className={`${inputCls} block`}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={loadGateway}
            disabled={loading}
            className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white hover:bg-[#40a9ff] disabled:opacity-50"
          >
            {loading ? "加载中…" : "刷新 Gateway"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#f0f0f0] pt-4">
          <label className="text-sm">
            <span className="text-[#8c8c8c]">DeepSeek cost CSV</span>
            <input
              type="file"
              accept=".csv"
              className="block text-sm"
              onChange={(e) => setCostFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">DeepSeek amount CSV</span>
            <input
              type="file"
              accept=".csv"
              className="block text-sm"
              onChange={(e) => setAmountFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={uploadCompare}
            disabled={uploading || (!costFile && !amountFile)}
            className="rounded border border-[#1890ff] px-3 py-1.5 text-sm text-[#1890ff] hover:bg-[#e6f7ff] disabled:opacity-50"
          >
            {uploading ? "对账中…" : "上传并对账"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      {data ? <SummaryCards summary={data.summary} /> : null}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["app", "按应用"],
            ["key", "按 Key"],
            ["reconcile", "日对账"],
            ["alerts", `差异摘要${alerts.length ? ` (${alerts.length})` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === id
                ? "bg-[#1890ff] text-white"
                : "border border-[#d9d9d9] bg-white hover:bg-[#fafafa]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <FinancePageState>加载 Gateway 用量…</FinancePageState>
      ) : data ? (
        <>
          {tab === "app" ? (
            <GatewayTable title="按应用 / clientPage" rows={data.platformByApp} />
          ) : null}
          {tab === "key" ? (
            <GatewayTable title="按 Gateway channel / Key" rows={data.byCredential} />
          ) : null}
          {tab === "reconcile" ? <CompareTable rows={dailyCompare} /> : null}
          {tab === "alerts" ? <CompareTable rows={alerts} /> : null}
        </>
      ) : null}
    </FinancePageShell>
  );
}
