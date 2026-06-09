"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type OverviewData = {
  filters: { since: string; tool: string; userId: string };
  totalYuan: number;
  totalCount: number;
  byMonth: Array<{ k: string; yuan: number; count: number }>;
  byTool: Array<{ k: string; label: string; yuan: number; count: number }>;
  byModel: Array<{ k: string; yuan: number; count: number }>;
  byUser: Array<{ k: string; label: string; yuan: number; count: number }>;
  recentLines: Array<{
    id: string;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
    userId: string;
    toolKey: string;
    modelKey: string;
    pricingTemplateKey: string | null;
    cloudUnitCostYuan: number | null;
    retailMultiplier: number | null;
    chargedPoints: number;
    yuan: number;
  }>;
  exportRows: Array<Record<string, unknown>>;
  exportRangeLabel: string;
};

const inputCls =
  "rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

function monthLabel(yyyymm: string): string {
  if (!/^\d{6}$/.test(yyyymm)) return yyyymm;
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`;
}

function exportCsv(rows: Array<Record<string, unknown>>, label: string) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys, ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`))].map((line) => line.join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usage-overview-${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AggList({
  title,
  rows,
  fmtKey,
  rowHref,
}: {
  title: string;
  rows: Array<{ k: string; label?: string; yuan: number; count: number }>;
  fmtKey?: (k: string) => string;
  rowHref?: (k: string) => string;
}) {
  const total = rows.reduce((s, r) => s + r.yuan, 0);
  return (
    <section className="rounded border border-[#e8e8e8] bg-white">
      <header className="border-b bg-[#fafafa] px-3 py-2 text-sm font-medium">
        {title}{" "}
        <span className="text-xs text-[#8c8c8c]">
          合计 ¥{total.toFixed(2)} · {rows.length} 项
        </span>
      </header>
      <ul className="divide-y text-sm">
        {rows.map(({ k, label, yuan, count }) => {
          const text = label ?? (fmtKey ? fmtKey(k) : k);
          const href = rowHref?.(k);
          const inner = (
            <div className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="flex-1 truncate" title={text}>
                {text}
              </span>
              <span className="text-xs text-[#8c8c8c]">{count} 次</span>
              <span className="w-20 text-right font-medium">¥{yuan.toFixed(2)}</span>
            </div>
          );
          return (
            <li key={k}>
              {href ? (
                <Link href={href} className="block hover:bg-[#fafafa]">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
        {rows.length === 0 ? <li className="px-3 py-4 text-center text-[#8c8c8c]">无数据</li> : null}
      </ul>
    </section>
  );
}

export function UsageOverviewClient() {
  const base = useBookMallBaseUrl();
  const [since, setSince] = useState("");
  const [tool, setTool] = useState("");
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (since) qs.set("since", since);
    if (tool) qs.set("tool", tool);
    if (userId) qs.set("userId", userId);
    const r = await financeApiFetch<OverviewData>(base, `/api/finance/admin/usage-overview?${qs}`);
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base, since, tool, userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (loading || !data) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">费用多维度概览</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            来源 ToolBillingDetailLine（TOOL_USAGE_GENERATED）。金额均为平台零售价。
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(data.exportRows, data.exportRangeLabel)}
          className="rounded border border-[#d9d9d9] px-3 py-1.5 text-sm hover:bg-[#fafafa]"
        >
          导出 CSV
        </button>
      </header>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-[#8c8c8c]">起始月份 YYYYMM</span>
            <input className={`${inputCls} w-36`} value={since} onChange={(e) => setSince(e.target.value)} placeholder="202512" />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">工具</span>
            <input className={`${inputCls} w-56`} value={tool} onChange={(e) => setTool(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">用户 ID</span>
            <input className={`${inputCls} w-48`} value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
          <button type="button" onClick={load} className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white">
            查询
          </button>
          <span className="text-xs text-[#8c8c8c]">
            共 {data.totalCount} 条 · 合计 ¥{data.totalYuan.toFixed(2)}
          </span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <AggList title="按月份" rows={data.byMonth} fmtKey={monthLabel} />
        <AggList title="按工具" rows={data.byTool} />
        <AggList title="按模型" rows={data.byModel} />
        <AggList
          title="按用户"
          rows={data.byUser}
          rowHref={(k) => `/admin/billing/users/${encodeURIComponent(k)}`}
        />
      </div>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">最新 50 条</h2>
        <table className="w-full text-xs">
          <thead className="bg-[#fafafa]">
            <tr>
              <th className="px-2 py-2 text-left">时间</th>
              <th className="px-2 py-2 text-left">用户</th>
              <th className="px-2 py-2 text-left">工具</th>
              <th className="px-2 py-2 text-left">模型</th>
              <th className="px-2 py-2 text-right">cost</th>
              <th className="px-2 py-2 text-right">M</th>
              <th className="px-2 py-2 text-right">扣点</th>
              <th className="px-2 py-2 text-right">≈¥</th>
            </tr>
          </thead>
          <tbody>
            {data.recentLines.map((l) => (
              <tr key={l.id} className="border-t hover:bg-[#fafafa]">
                <td className="px-2 py-1.5 text-[#8c8c8c]">{l.createdAt}</td>
                <td className="px-2 py-1.5">{l.userName ?? l.userEmail ?? l.userId}</td>
                <td className="px-2 py-1.5">
                  <code>{l.toolKey}</code>
                </td>
                <td className="px-2 py-1.5">
                  <code>{l.modelKey}</code>
                </td>
                <td className="px-2 py-1.5 text-right">{l.cloudUnitCostYuan?.toFixed(4) ?? "—"}</td>
                <td className="px-2 py-1.5 text-right">{l.retailMultiplier ?? "—"}</td>
                <td className="px-2 py-1.5 text-right">{l.chargedPoints > 0 ? l.chargedPoints : "—"}</td>
                <td className="px-2 py-1.5 text-right">¥{l.yuan.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
