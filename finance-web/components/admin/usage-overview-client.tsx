"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";
import {
  PackageReconciliationPanel,
  type PackageReconciliationData,
} from "@/components/package-reconciliation-panel";

type OverviewData = {
  filters: { since: string; tool: string; userId: string };
  totalYuan: number;
  totalCredits: number;
  totalCount: number;
  totalCallsAll: number;
  byMonth: Array<{ k: string; yuan: number; count: number; credits: number }>;
  byTool: Array<{ k: string; label: string; yuan: number; count: number; credits: number }>;
  byModel: Array<{ k: string; yuan: number; count: number; credits: number }>;
  byUser: Array<{ k: string; label: string; yuan: number; count: number; credits: number }>;
  recentLines: Array<{
    id: string;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
    userId: string;
    toolKey: string;
    modelKey: string;
    requestKind: string;
    billingPersona: string;
    creditsConsumed: number;
    feeDescription: string;
    settlementKind: string;
    taskKind: string;
    quotaDelta: string;
    includedRemaining: string;
    yuan: number;
  }>;
  exportRows: Array<Record<string, unknown>>;
  exportRangeLabel: string;
  packageReconciliation?: PackageReconciliationData | null;
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
  rows: Array<{ k: string; label?: string; yuan: number; count: number; credits: number }>;
  fmtKey?: (k: string) => string;
  rowHref?: (k: string) => string;
}) {
  const totalCredits = rows.reduce((s, r) => s + r.credits, 0);
  const totalCalls = rows.reduce((s, r) => s + r.count, 0);
  return (
    <section className="rounded border border-[#e8e8e8] bg-white">
      <header className="border-b bg-[#fafafa] px-3 py-2 text-sm font-medium">
        {title}{" "}
        <span className="text-xs text-[#8c8c8c]">
          {totalCalls} 次 · {totalCredits} 积分 · {rows.length} 项
        </span>
      </header>
      <ul className="divide-y text-sm">
        {rows.map(({ k, label, yuan, count, credits }) => {
          const text = label ?? (fmtKey ? fmtKey(k) : k);
          const href = rowHref?.(k);
          const inner = (
            <div className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="flex-1 truncate" title={text}>
                {text}
              </span>
              <span className="text-xs text-[#8c8c8c]">{count} 次</span>
              <span className="w-16 text-right text-xs text-[#8c8c8c]">
                {credits > 0 ? `${credits} 积分` : "0 积分"}
              </span>
              {yuan > 0 ? (
                <span className="w-20 text-right font-medium">≈¥{yuan.toFixed(2)}</span>
              ) : null}
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
  const [billingPersona, setBillingPersona] = useState("");
  const [staffFlag, setStaffFlag] = useState("");
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
    if (billingPersona) qs.set("billingPersona", billingPersona);
    if (staffFlag) qs.set("staffFlag", staffFlag);
    const r = await financeApiFetch<OverviewData>(base, `/api/finance/admin/usage-overview?${qs}`);
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base, since, tool, userId, billingPersona, staffFlag]);

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
            来源 GatewayRequestLog（财务 2.0）。含 BYOK 0 积分成功调用；扣积分行另计锚定金额。
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
          <div className="flex flex-wrap gap-1">
            {[
              { value: "", label: "全部身份" },
              { value: "PLATFORM_CREDIT", label: "平台代付" },
              { value: "BYOK", label: "自带 Key" },
            ].map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => setBillingPersona(tab.value)}
                className={`rounded px-2 py-1 text-xs ${
                  billingPersona === tab.value
                    ? "bg-[#1890ff] text-white"
                    : "border border-[#d9d9d9] hover:bg-[#fafafa]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            className={inputCls}
            value={staffFlag}
            onChange={(e) => setStaffFlag(e.target.value)}
          >
            <option value="">员工：全部</option>
            <option value="1">仅员工账号</option>
            <option value="0">排除员工</option>
          </select>
          <button type="button" onClick={load} className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white">
            查询
          </button>
          <span className="text-xs text-[#8c8c8c]">
            成功调用 {data.totalCallsAll} 次 · 扣积分 {data.totalCount} 条 · 消耗 {data.totalCredits} 积分
            {data.totalYuan > 0 ? ` · ≈¥${data.totalYuan.toFixed(2)}` : ""}
          </span>
        </div>
      </section>

      {data.packageReconciliation ? (
        <PackageReconciliationPanel data={data.packageReconciliation} />
      ) : null}

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
              <th className="px-2 py-2 text-left">请求类型</th>
              <th className="px-2 py-2 text-left">计费身份</th>
              <th className="px-2 py-2 text-right">消耗积分</th>
              <th className="px-2 py-2 text-left">结算类型</th>
              <th className="px-2 py-2 text-left">任务/扣次/剩余</th>
              <th className="px-2 py-2 text-left">费用说明</th>
            </tr>
          </thead>
          <tbody>
            {data.recentLines.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-2 py-6 text-center text-[#8c8c8c]">
                  无数据
                </td>
              </tr>
            ) : null}
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
                <td className="px-2 py-1.5">{l.requestKind}</td>
                <td className="px-2 py-1.5">{l.billingPersona}</td>
                <td className="px-2 py-1.5 text-right">{l.creditsConsumed}</td>
                <td className="px-2 py-1.5">{l.settlementKind || "—"}</td>
                <td className="px-2 py-1.5 text-[#595959]">
                  {[l.taskKind, l.quotaDelta !== "—" && l.quotaDelta !== "" ? `-${l.quotaDelta}` : null, l.includedRemaining !== "—" ? `剩${l.includedRemaining}` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-2 py-1.5 text-[#595959]">{l.feeDescription}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
