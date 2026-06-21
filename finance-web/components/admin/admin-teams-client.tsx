"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import {
  FinanceTokenUsageHeaderCells,
  FinanceTokenUsageRowCells,
  type FinanceTokenUsage,
} from "@/components/admin/finance-token-usage-columns";
import { financeApiFetch } from "@/lib/finance-viewer";
import { formatUserCellPrimary } from "@/lib/user-contact-display";

function recentPeriodKeys(count = 6): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

type TeamRow = {
  tenantId: string;
  name: string;
  packageLevel: string | null;
  seatLimit: number;
  activeMembers: number;
  balanceCredits: number;
  monthConsumed: number;
  packageTotalCredits: number | null;
  packageTotalPriceYuan: number | null;
  packageIntervalLabel: string;
  periodStartAt: string;
  periodEndAt: string | null;
  renewalCount: number;
  owner: { id: string; name: string | null; email: string | null; phone: string | null };
  tokenUsage: FinanceTokenUsage;
};

type TeamsResponse = {
  periodKey: string;
  teams: TeamRow[];
  total: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

function fmtYuan(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("zh-CN");
}

export function AdminTeamsClient() {
  const base = useBookMallBaseUrl();
  const periods = useMemo(() => recentPeriodKeys(), []);
  const [periodKey, setPeriodKey] = useState(periods[0] ?? "");
  const [data, setData] = useState<TeamsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!base || !periodKey) return;
    setError(null);
    financeApiFetch<TeamsResponse>(
      base,
      `/api/finance/admin/teams?periodKey=${encodeURIComponent(periodKey)}`,
    ).then((r) => (r.ok ? setData(r.data) : setError(r.error)));
  }, [base, periodKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState>加载中…</FinancePageState>;

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">团队列表</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            账期 {data.periodKey} · 共 {data.total} 个团队 · Gateway 用量与状态驾驶舱「团队 +
            同一账期」同源；全站文生图/试衣见「用户列表」，人像入库归「其他 · 次」
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#595959]">
          <span>账期</span>
          <select
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="rounded border border-[#d9d9d9] bg-white px-2 py-1"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <table className="w-full min-w-[2400px] text-sm">
          <thead>
            <tr className="bg-[#fafafa] text-left text-[#595959]">
              <th className="border border-[#e8e8e8] px-3 py-2">团队</th>
              <th className="border border-[#e8e8e8] px-3 py-2">套餐</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">套餐总积分</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">套餐总金额</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">剩余积分</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">本月消耗（积分）</th>
              <FinanceTokenUsageHeaderCells />
              <th className="border border-[#e8e8e8] px-3 py-2">计费周期</th>
              <th className="border border-[#e8e8e8] px-3 py-2">起始日</th>
              <th className="border border-[#e8e8e8] px-3 py-2">到期日</th>
              <th className="border border-[#e8e8e8] px-3 py-2 text-right">续期次数</th>
              <th className="border border-[#e8e8e8] px-3 py-2">席位</th>
              <th className="border border-[#e8e8e8] px-3 py-2">主账号</th>
              <th className="border border-[#e8e8e8] px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => (
              <tr key={t.tenantId} className="hover:bg-[#fafafa]">
                <td className="border border-[#e8e8e8] px-3 py-2 font-medium">{t.name}</td>
                <td className="border border-[#e8e8e8] px-3 py-2">{t.packageLevel ?? "—"}</td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">
                  {t.packageTotalCredits != null ? fmt(t.packageTotalCredits) : "—"}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">
                  {fmtYuan(t.packageTotalPriceYuan)}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">
                  {fmt(t.balanceCredits)}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">
                  {fmt(t.monthConsumed)}
                </td>
                <FinanceTokenUsageRowCells usage={t.tokenUsage} />
                <td className="border border-[#e8e8e8] px-3 py-2">{t.packageIntervalLabel}</td>
                <td className="border border-[#e8e8e8] px-3 py-2">{fmtDate(t.periodStartAt)}</td>
                <td className="border border-[#e8e8e8] px-3 py-2">
                  {t.periodEndAt ? fmtDate(t.periodEndAt) : "—"}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2 text-right font-mono">
                  {t.renewalCount}
                </td>
                <td className="border border-[#e8e8e8] px-3 py-2">
                  {t.activeMembers} / {t.seatLimit}
                </td>
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
