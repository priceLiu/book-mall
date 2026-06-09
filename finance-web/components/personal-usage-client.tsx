"use client";

import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type UsageData = {
  balance: number;
  pools: {
    general: { balance: number; reserved: number };
    video: { balance: number; reserved: number };
    pricePerCreditYuan: number | null;
  };
  totalConsumed: number;
  byModel: { canonicalModelKey: string; count: number; creditsCharged: number }[];
  recent: {
    id: string;
    canonicalModelKey: string | null;
    requestKind: string | null;
    status: string;
    creditsCharged: number | null;
    submittedAt: string;
  }[];
};

const STATUS: Record<string, string> = {
  SUCCEEDED: "成功",
  FAILED: "失败",
  RUNNING: "进行中",
  PENDING: "待处理",
  CANCELLED: "已取消",
};

export function PersonalUsageClient() {
  const base = useBookMallBaseUrl();
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) return;
    financeApiFetch<UsageData>(base, "/api/finance/account/usage")
      .then((r) => (r.ok ? setData(r.data) : setError(r.error)))
      .catch(() => setError("加载失败"));
  }, [base]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-lg font-medium text-[#262626]">积分用量中心</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">财务 2.0 · 双池余额、按模型消耗与近期生成记录。</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="通用池余额" value={data.balance} />
        <StatCard label="视频池余额" value={data.pools.video.balance} />
        <StatCard label="视频冻结中" value={data.pools.video.reserved} />
        <StatCard label="累计消耗" value={data.totalConsumed} />
      </div>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-[#262626]">按模型汇总</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[#8c8c8c]">
              <th className="py-2">模型</th>
              <th className="py-2 text-right">次数</th>
              <th className="py-2 text-right">积分</th>
            </tr>
          </thead>
          <tbody>
            {data.byModel.map((m) => (
              <tr key={m.canonicalModelKey} className="border-b border-[#f0f0f0]">
                <td className="py-2 font-mono text-xs">{m.canonicalModelKey}</td>
                <td className="py-2 text-right">{m.count}</td>
                <td className="py-2 text-right">{m.creditsCharged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-[#262626]">近期生成</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[#8c8c8c]">
              <th className="py-2">时间</th>
              <th className="py-2">模型</th>
              <th className="py-2">类型</th>
              <th className="py-2">状态</th>
              <th className="py-2 text-right">积分</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((r) => (
              <tr key={r.id} className="border-b border-[#f0f0f0]">
                <td className="py-2 text-xs text-[#8c8c8c]">
                  {new Date(r.submittedAt).toLocaleString("zh-CN")}
                </td>
                <td className="py-2 font-mono text-xs">{r.canonicalModelKey ?? "—"}</td>
                <td className="py-2">{r.requestKind ?? "—"}</td>
                <td className="py-2">{STATUS[r.status] ?? r.status}</td>
                <td className="py-2 text-right">{r.creditsCharged ?? 0}</td>
              </tr>
            ))}
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
