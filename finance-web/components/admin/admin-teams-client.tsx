"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";
import { formatUserCellPrimary } from "@/lib/user-contact-display";

type TeamRow = {
  tenantId: string;
  name: string;
  packageLevel: string | null;
  seatLimit: number;
  activeMembers: number;
  balanceCredits: number;
  monthConsumed: number;
  owner: { id: string; name: string | null; email: string | null; phone: string | null };
};

type TeamsResponse = {
  periodKey: string;
  teams: TeamRow[];
  total: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

export function AdminTeamsClient() {
  const base = useBookMallBaseUrl();
  const [data, setData] = useState<TeamsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!base) return;
    financeApiFetch<TeamsResponse>(base, "/api/finance/admin/teams").then((r) =>
      r.ok ? setData(r.data) : setError(r.error),
    );
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState>加载中…</FinancePageState>;

  return (
    <FinancePageShell>
      <header>
        <h1 className="text-lg font-medium text-[#262626]">团队列表</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">账期 {data.periodKey} · 共 {data.total} 个团队</p>
      </header>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="bg-[#fafafa] text-left text-[#595959]">
              <th className="border border-[#e8e8e8] px-3 py-2">团队</th>
              <th className="border border-[#e8e8e8] px-3 py-2">套餐</th>
              <th className="border border-[#e8e8e8] px-3 py-2">席位</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">池余额</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">本月消耗</th>
              <th className="border border-[#e8e8e8] px-3 py-2">主账号</th>
              <th className="border border-[#e8e8e8] px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => (
              <tr key={t.tenantId} className="hover:bg-[#fafafa]">
                <td className="border border-[#e8e8e8] px-3 py-2 font-medium">{t.name}</td>
                <td className="border border-[#e8e8e8] px-3 py-2">{t.packageLevel ?? "—"}</td>
                <td className="border border-[#e8e8e8] px-3 py-2">
                  {t.activeMembers} / {t.seatLimit}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">{fmt(t.balanceCredits)}</td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">{fmt(t.monthConsumed)}</td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-xs text-[#595959]">
                  {formatUserCellPrimary(t.owner)}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2">
                  <Link href={`/admin/teams/${t.tenantId}`} className="text-[#1890ff] hover:underline">
                    进入 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </FinancePageShell>
  );
}
