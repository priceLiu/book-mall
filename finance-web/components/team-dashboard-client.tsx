"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";
import { formatUserCellPrimary } from "@/lib/user-contact-display";

type DashboardResponse = {
  hasTeam: boolean;
  canView?: boolean;
  tenantId?: string;
  tenantName?: string;
  role?: string;
  period: string;
  periods: string[];
  teams: { tenantId: string; tenantName: string; role: string; canViewBilling: boolean }[];
  dashboard?: {
    periodKey: string;
    bill: {
      granted: number;
      consumed: number;
      refunded: number;
      topup: number;
      balanceCredits: number;
      members: { actorUserId: string; name: string | null; email: string | null; phone: string | null; consumed: number; count: number }[];
      byModel: { canonicalModelKey: string; credits: number; count: number }[];
    };
    seatUsage: { used: number; limit: number };
    byCategory: { category: string; label: string; count: number; credits: number }[];
    dailyTrend: { date: string; credits: number; count: number }[];
    recentLogs: {
      id: string;
      submittedAt: string;
      actorName: string | null;
      canonicalModelKey: string | null;
      creditsCharged: number | null;
      status: string;
    }[];
    note?: string;
  } | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

export function TeamDashboardClient() {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantIdParam = searchParams.get("tenantId");
  const periodParam = searchParams.get("period");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!base) {
      setError("未配置主站地址（BOOK_MALL_URL）");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (tenantIdParam) qs.set("tenantId", tenantIdParam);
    if (periodParam) qs.set("period", periodParam);
    try {
      const r = await financeApiFetch<DashboardResponse>(
        base,
        `/api/finance/team/dashboard${qs.toString() ? `?${qs}` : ""}`,
      );
      if (r.ok) setData(r.data);
      else setError(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base, tenantIdParam, periodParam]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <FinancePageState>加载中…</FinancePageState>;
  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState variant="error">加载失败</FinancePageState>;

  if (!data.hasTeam) {
    return (
      <FinancePageShell>
        <h1 className="text-lg font-medium">团队驾驶舱</h1>
        <p className="text-sm text-[#8c8c8c]">您尚未加入任何团队空间。</p>
      </FinancePageShell>
    );
  }

  if (!data.dashboard) {
    return (
      <FinancePageShell>
        <h1 className="text-lg font-medium">团队驾驶舱</h1>
        <p className="text-sm text-[#8c8c8c]">仅团队主账号或管理员可查看团队财务驾驶舱。</p>
      </FinancePageShell>
    );
  }

  const dash = data.dashboard;
  const bill = dash.bill;
  const qsTenant = data.tenantId ? `tenantId=${data.tenantId}` : "";

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">团队驾驶舱 · {data.tenantName}</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">共享积分池总览与成员消耗分布</p>
        </div>
        <div className="flex gap-2">
          {data.teams.length > 1 ? (
            <select
              className="rounded border border-[#d9d9d9] px-2 py-1 text-sm"
              value={data.tenantId}
              onChange={(e) => router.push(`/team?tenantId=${e.target.value}&period=${data.period}`)}
            >
              {data.teams.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.tenantName}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="rounded border border-[#d9d9d9] px-2 py-1 text-sm"
            value={data.period}
            onChange={(e) => router.push(`/team?${qsTenant}&period=${e.target.value}`)}
          >
            {data.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="剩余积分" value={bill.balanceCredits} />
        <Stat label="月消耗" value={bill.consumed} />
        <Stat label="月发放" value={bill.granted} />
        <Stat label="席位占用" value={dash.seatUsage.used} suffix={`/ ${dash.seatUsage.limit}`} />
        <Stat label="月返还" value={bill.refunded} />
      </div>

      {dash.note ? <p className="text-xs text-[#8c8c8c]">{dash.note}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="成员消耗 Top">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#8c8c8c]">
                <th className="py-2">成员</th>
                <th className="py-2 text-right">次数</th>
                <th className="py-2 text-right">积分</th>
              </tr>
            </thead>
            <tbody>
              {bill.members.slice(0, 10).map((m) => (
                <tr key={m.actorUserId} className="border-t border-[#f0f0f0]">
                  <td className="py-2">
                    <Link
                      href={`/team/members/${m.actorUserId}?${qsTenant}`}
                      className="text-[#1890ff] hover:underline"
                    >
                      {formatUserCellPrimary({ ...m, id: m.actorUserId })}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{m.count}</td>
                  <td className="py-2 text-right">{fmt(m.consumed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="按模型">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#8c8c8c]">
                <th className="py-2">模型</th>
                <th className="py-2 text-right">积分</th>
              </tr>
            </thead>
            <tbody>
              {bill.byModel.slice(0, 8).map((m) => (
                <tr key={m.canonicalModelKey} className="border-t border-[#f0f0f0]">
                  <td className="py-2 font-mono text-xs">{m.canonicalModelKey}</td>
                  <td className="py-2 text-right">{fmt(m.credits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      {dash.byCategory.length > 0 ? (
        <Section title="按计费类别">
          <div className="flex flex-wrap gap-2">
            {dash.byCategory.map((c) => (
              <span key={c.category} className="rounded border border-[#e8e8e8] bg-[#fafafa] px-2 py-1 text-xs">
                {c.label} · {c.count} 次 · {fmt(c.credits)} 分
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="近期调用">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#8c8c8c]">
              <th className="py-2">时间</th>
              <th className="py-2">成员</th>
              <th className="py-2">模型</th>
              <th className="py-2 text-right">积分</th>
            </tr>
          </thead>
          <tbody>
            {dash.recentLogs.slice(0, 20).map((r) => (
              <tr key={r.id} className="border-t border-[#f0f0f0]">
                <td className="py-2 text-xs text-[#8c8c8c]">
                  {new Date(r.submittedAt).toLocaleString("zh-CN")}
                </td>
                <td className="py-2">{r.actorName ?? "—"}</td>
                <td className="py-2 font-mono text-xs">{r.canonicalModelKey ?? "—"}</td>
                <td className="py-2 text-right">{r.creditsCharged ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </FinancePageShell>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded border border-[#e8e8e8] bg-white p-4">
      <p className="text-xs text-[#8c8c8c]">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        {fmt(value)}
        {suffix ? <span className="text-sm font-normal text-[#8c8c8c]"> {suffix}</span> : null}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[#e8e8e8] bg-white p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}
