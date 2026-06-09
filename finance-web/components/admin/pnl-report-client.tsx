"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type PnlRow = {
  periodKey: string;
  revenueYuan: number;
  costYuan: number;
  marginRate: number;
  consumeCredits: number;
};

export function PnlReportClient() {
  const base = useBookMallBaseUrl();
  const [periodKey, setPeriodKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [row, setRow] = useState<PnlRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<{ ok: boolean; report: PnlRow }>(
      base,
      `/api/finance/admin/pnl-report?periodKey=${encodeURIComponent(periodKey)}`,
    );
    if (r.ok && r.data.ok) setRow(r.data.report);
    else setError(r.ok ? "加载失败" : r.error);
  }, [base, periodKey]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-medium">P&amp;L 报表</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">基于 CreditLedger SETTLE/CONSUME 汇总营收与成本。</p>
      </header>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-[#8c8c8c]">账期</span>
        <input
          className="rounded border border-[#d9d9d9] px-2 py-1"
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value)}
        />
        <button type="button" className="rounded bg-[#1890ff] px-2 py-1 text-white" onClick={load}>
          刷新
        </button>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {row ? (
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-t">
              <td className="py-2">营收</td>
              <td className="py-2 text-right">¥{row.revenueYuan.toFixed(2)}</td>
            </tr>
            <tr className="border-t">
              <td className="py-2">成本</td>
              <td className="py-2 text-right">¥{row.costYuan.toFixed(2)}</td>
            </tr>
            <tr className="border-t">
              <td className="py-2">毛利</td>
              <td className="py-2 text-right">{(row.marginRate * 100).toFixed(1)}%</td>
            </tr>
            <tr className="border-t">
              <td className="py-2">消耗积分</td>
              <td className="py-2 text-right">{row.consumeCredits}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
