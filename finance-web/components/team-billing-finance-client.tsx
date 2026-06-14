"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";

type TeamBill = {
  periodKey: string;
  granted: number;
  consumed: number;
  refunded: number;
  topup: number;
  net: number;
  balanceCredits: number;
  monthlyGrantCredits: number;
  byModel: { canonicalModelKey: string; credits: number; count: number }[];
  members: {
    actorUserId: string;
    name: string | null;
    email: string | null;
    consumed: number;
    count: number;
    byModel: { canonicalModelKey: string; credits: number; count: number }[];
  }[];
};

type TeamBillingResponse = {
  hasTeam: boolean;
  canView?: boolean;
  tenantId?: string;
  tenantName?: string | null;
  period: string;
  periods: string[];
  teams: { tenantId: string; tenantName: string; role: string; canViewBilling: boolean }[];
  bill: TeamBill | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

export function TeamBillingFinanceClient() {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<TeamBillingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!base) return;
    const tenantId = searchParams.get("tenantId");
    const period = searchParams.get("period");
    const qs = new URLSearchParams();
    if (tenantId) qs.set("tenantId", tenantId);
    if (period) qs.set("period", period);
    const path = `/api/finance/team/billing${qs.toString() ? `?${qs}` : ""}`;
    financeApiFetch<TeamBillingResponse>(base, path).then((r) =>
      r.ok ? setData(r.data) : setError(r.error),
    );
  }, [base, searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState>加载中…</FinancePageState>;

  if (!data.hasTeam) {
    return (
      <FinancePageShell>
        <h1 className="text-lg font-medium">团队账单</h1>
        <p className="text-sm text-[#8c8c8c]">您尚未加入任何团队空间。</p>
      </FinancePageShell>
    );
  }

  if (!data.canView) {
    return (
      <FinancePageShell>
        <h1 className="text-lg font-medium">团队账单</h1>
        <p className="text-sm text-[#8c8c8c]">
          仅团队主账号或管理员可查看共享积分池账单。您当前角色：{data.teams.find((t) => t.tenantId === data.tenantId)?.role}
        </p>
      </FinancePageShell>
    );
  }

  const bill = data.bill;

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">团队账单 · {data.tenantName}</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">共享积分池总账，按模型与成员下钻（财务 2.0）。</p>
        </div>
        <div className="flex gap-2">
          {data.teams.length > 1 ? (
            <select
              className="rounded border border-[#d9d9d9] px-2 py-1 text-sm"
              value={data.tenantId}
              onChange={(e) => router.push(`/team/billing?tenantId=${e.target.value}&period=${data.period}`)}
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
            onChange={(e) =>
              router.push(`/team/billing?tenantId=${data.tenantId}&period=${e.target.value}`)
            }
          >
            {data.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </header>

      {bill ? (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            <Stat label="月发放" value={bill.granted} />
            <Stat label="消耗" value={bill.consumed} />
            <Stat label="返还" value={bill.refunded} />
            <Stat label="充值" value={bill.topup} />
            <Stat label="池余额" value={bill.balanceCredits} />
          </div>

          <TableSection title="按模型">
            <thead>
              <tr className="text-left text-[#8c8c8c]">
                <th className="py-2">模型</th>
                <th className="py-2 text-right">次数</th>
                <th className="py-2 text-right">积分</th>
              </tr>
            </thead>
            <tbody>
              {bill.byModel.map((m) => (
                <tr key={m.canonicalModelKey} className="border-t border-[#f0f0f0]">
                  <td className="py-2 font-mono text-xs">{m.canonicalModelKey}</td>
                  <td className="py-2 text-right">{m.count}</td>
                  <td className="py-2 text-right">{fmt(m.credits)}</td>
                </tr>
              ))}
            </tbody>
          </TableSection>

          <TableSection title="按成员">
            <thead>
              <tr className="text-left text-[#8c8c8c]">
                <th className="py-2">成员</th>
                <th className="py-2 text-right">次数</th>
                <th className="py-2 text-right">消耗积分</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {bill.members.map((m) => (
                <tr key={m.actorUserId} className="border-t border-[#f0f0f0]">
                  <td className="py-2">
                    {m.name || m.email || m.actorUserId.slice(0, 8)}
                  </td>
                  <td className="py-2 text-right">{m.count}</td>
                  <td className="py-2 text-right">{fmt(m.consumed)}</td>
                  <td className="py-2">
                    <Link
                      href={`/team/members/${m.actorUserId}?tenantId=${data.tenantId}`}
                      className="text-[#1890ff] hover:underline text-xs"
                    >
                      明细 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableSection>
        </>
      ) : (
        <p className="text-sm text-[#8c8c8c]">暂无账单数据。</p>
      )}
    </FinancePageShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#e8e8e8] bg-white p-4">
      <p className="text-xs text-[#8c8c8c]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{fmt(value)}</p>
    </div>
  );
}

function TableSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-[#e8e8e8] bg-white p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <table className="w-full text-sm">{children}</table>
    </section>
  );
}
