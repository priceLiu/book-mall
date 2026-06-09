"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type CreditBill = {
  periodKey: string;
  granted: number;
  consumed: number;
  refunded: number;
  topup: number;
  net: number;
  byModel: { canonicalModelKey: string; credits: number; count: number }[];
};

type BillingResponse = {
  periodKey: string;
  bill: CreditBill;
};

function recentPeriodKeys(count = 6): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function BillingOverviewClient() {
  const base = useBookMallBaseUrl();
  const periods = recentPeriodKeys();
  const [periodKey, setPeriodKey] = useState(periods[0]);
  const [data, setData] = useState<BillingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<BillingResponse>(
      base,
      `/api/finance/account/billing?periodKey=${encodeURIComponent(periodKey)}`,
    );
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [base, periodKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;

  const bill = data.bill;

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">账单概览</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            财务 2.0 · 月度积分发放、消耗、返还与充值汇总（平台代付账号）。
          </p>
        </div>
        <select
          className="rounded border border-[#d9d9d9] px-2 py-1 text-sm"
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value)}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </header>

      <div className="grid gap-3 sm:grid-cols-5">
        <StatCard label="月发放" value={bill.granted} />
        <StatCard label="消耗" value={bill.consumed} />
        <StatCard label="返还" value={bill.refunded} />
        <StatCard label="充值" value={bill.topup} />
        <StatCard label="净变动" value={bill.net} />
      </div>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-[#262626]">按模型消耗</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[#8c8c8c]">
              <th className="py-2">模型</th>
              <th className="py-2 text-right">次数</th>
              <th className="py-2 text-right">积分</th>
            </tr>
          </thead>
          <tbody>
            {bill.byModel.map((m) => (
              <tr key={m.canonicalModelKey} className="border-b border-[#f0f0f0]">
                <td className="py-2 font-mono text-xs">{m.canonicalModelKey}</td>
                <td className="py-2 text-right">{m.count}</td>
                <td className="py-2 text-right">{m.credits.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
            {bill.byModel.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-[#8c8c8c]">
                  本月暂无消耗记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#e8e8e8] bg-white p-4">
      <p className="text-xs text-[#8c8c8c]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#262626]">{value.toLocaleString("zh-CN")}</p>
    </div>
  );
}
