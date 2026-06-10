"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";

type UsageData = {
  balance: number;
  pools: {
    general: { balance: number; reserved: number };
    video: { balance: number; reserved: number };
    pricePerCreditYuan: number | null;
  };
  totalCalls: number;
  totalConsumed: number;
  byModel: { canonicalModelKey: string; count: number; creditsCharged: number }[];
  byTool: {
    toolKey: string;
    toolLabel: string;
    count: number;
    creditsCharged: number;
  }[];
  recent: {
    id: string;
    canonicalModelKey: string | null;
    clientSource: string | null;
    clientPage: string | null;
    toolLabel?: string;
    billingMode: string | null;
    billingPersonaSnap: string | null;
    staffFlag: boolean;
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

const PERSONA_LABEL: Record<string, string> = {
  PLATFORM_CREDIT: "平台代付",
  BYOK: "自带 Key",
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

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState>加载中…</FinancePageState>;

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">积分用量中心</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            财务 2.0 · 总次数、双池余额、按工具/模型消耗与近期生成记录。
          </p>
        </div>
        <Link
          href="/fees/billing/details?tab=usage"
          className="text-sm text-[#1890ff] hover:underline"
        >
          账单详情（全部用量）→
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="成功调用总次数" value={data.totalCalls} />
        <StatCard label="通用池余额" value={data.balance} />
        <StatCard label="视频池余额" value={data.pools.video.balance} />
        <StatCard label="视频冻结中" value={data.pools.video.reserved} />
        <StatCard label="累计消耗积分" value={data.totalConsumed} />
      </div>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-[#262626]">按工具汇总</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[#8c8c8c]">
              <th className="py-2">工具</th>
              <th className="py-2 text-right">次数</th>
              <th className="py-2 text-right">积分</th>
            </tr>
          </thead>
          <tbody>
            {data.byTool.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-[#8c8c8c]">
                  暂无记录
                </td>
              </tr>
            ) : (
              data.byTool.map((t) => (
                <tr key={t.toolKey} className="border-b border-[#f0f0f0]">
                  <td className="py-2">{t.toolLabel}</td>
                  <td className="py-2 text-right">{t.count}</td>
                  <td className="py-2 text-right">{t.creditsCharged}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

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
              <th className="py-2">工具</th>
              <th className="py-2">模型</th>
              <th className="py-2">类型</th>
              <th className="py-2">计费</th>
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
                <td className="py-2">{r.toolLabel ?? r.clientSource ?? "—"}</td>
                <td className="py-2 font-mono text-xs">{r.canonicalModelKey ?? "—"}</td>
                <td className="py-2">{r.requestKind ?? "—"}</td>
                <td className="py-2">
                  {r.billingPersonaSnap
                    ? (PERSONA_LABEL[r.billingPersonaSnap] ?? r.billingMode ?? "—")
                    : (r.billingMode ?? "—")}
                  {r.staffFlag ? (
                    <span className="ml-1 rounded bg-amber-50 px-1 text-xs text-amber-700">员工</span>
                  ) : null}
                </td>
                <td className="py-2">{STATUS[r.status] ?? r.status}</td>
                <td className="py-2 text-right">{r.creditsCharged ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </FinancePageShell>
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
