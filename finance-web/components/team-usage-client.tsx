"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type TeamUsageResponse = {
  hasTeam: boolean;
  tenantId?: string;
  tenantName?: string;
  role?: string;
  teams: { tenantId: string; tenantName: string; role: string }[];
  byModel: { canonicalModelKey: string; count: number; creditsCharged: number }[];
  recent: {
    id: string;
    canonicalModelKey: string | null;
    clientSource: string | null;
    billingMode: string | null;
    billingPersonaSnap: string | null;
    staffFlag: boolean;
    requestKind: string | null;
    status: string;
    creditsCharged: number | null;
    submittedAt: string;
  }[];
  totalConsumed: number;
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

export function TeamUsageClient() {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<TeamUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!base) return;
    const tenantId = searchParams.get("tenantId");
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    financeApiFetch<TeamUsageResponse>(base, `/api/finance/team/usage${qs}`).then((r) =>
      r.ok ? setData(r.data) : setError(r.error),
    );
  }, [base, searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;

  if (!data.hasTeam) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-medium">我的团队用量</h1>
        <p className="mt-2 text-sm text-[#8c8c8c]">您尚未加入任何团队空间。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">我的团队用量 · {data.tenantName}</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            只读视图 · 您在团队内的 AI 调用与扣分（角色：{data.role}）
          </p>
        </div>
        {data.teams.length > 1 ? (
          <select
            className="rounded border border-[#d9d9d9] px-2 py-1 text-sm"
            value={data.tenantId}
            onChange={(e) => router.push(`/team/usage?tenantId=${e.target.value}`)}
          >
            {data.teams.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>
                {t.tenantName}
              </option>
            ))}
          </select>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-[#e8e8e8] bg-white p-4">
          <p className="text-xs text-[#8c8c8c]">团队内累计消耗</p>
          <p className="mt-1 text-xl font-semibold">{data.totalConsumed.toLocaleString("zh-CN")}</p>
        </div>
      </div>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">按模型</h2>
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
        <h2 className="mb-3 text-sm font-medium">近期记录</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[#8c8c8c]">
              <th className="py-2">时间</th>
              <th className="py-2">工具</th>
              <th className="py-2">模型</th>
              <th className="py-2">模式</th>
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
                <td className="py-2">{r.clientSource ?? "—"}</td>
                <td className="py-2 font-mono text-xs">{r.canonicalModelKey ?? "—"}</td>
                <td className="py-2">
                  {r.billingPersonaSnap
                    ? (PERSONA_LABEL[r.billingPersonaSnap] ?? r.billingMode ?? "—")
                    : (r.billingMode ?? "—")}
                </td>
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
