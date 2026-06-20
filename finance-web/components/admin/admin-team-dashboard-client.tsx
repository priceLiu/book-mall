"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  FinanceTokenUsageSummaryPanel,
  type FinanceTokenUsage,
} from "@/components/admin/finance-token-usage-columns";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";
import { formatUserCellPrimary } from "@/lib/user-contact-display";

type PackageSnapshot = {
  packageTotalCredits: number | null;
  packageTotalPriceYuan: number | null;
  packageInterval: string | null;
  packageIntervalLabel: string;
  periodStartAt: string;
  periodEndAt: string | null;
  renewalCount: number;
  remainingCredits: number;
  generalGrantCredits: number;
  videoGrantCredits: number;
  monthlyGrantCredits: number;
};

type AdminTeamDashboardResponse = {
  tenantId: string;
  tenantName: string;
  period: string;
  periods: string[];
  packageSnapshot: PackageSnapshot;
  dashboard: {
    bill: {
      consumed: number;
      balanceCredits: number;
      members: {
        actorUserId: string;
        name: string | null;
        email: string | null;
        phone: string | null;
        consumed: number;
      }[];
    };
    seatUsage: { used: number; limit: number };
    vendorCostYuan?: number;
    note?: string;
    tokenUsage?: FinanceTokenUsage;
  };
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

export function AdminTeamDashboardClient({ tenantId }: { tenantId: string }) {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AdminTeamDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!base) return;
    const period = searchParams.get("period");
    const qs = period ? `?period=${encodeURIComponent(period)}` : "";
    financeApiFetch<AdminTeamDashboardResponse>(
      base,
      `/api/finance/admin/teams/${encodeURIComponent(tenantId)}/dashboard${qs}`,
    ).then((r) => (r.ok ? setData(r.data) : setError(r.error)));
  }, [base, tenantId, searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState>加载中…</FinancePageState>;

  const dash = data.dashboard;
  const pkg = data.packageSnapshot;

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/teams" className="text-sm text-[#1890ff] hover:underline">
            ← 团队列表
          </Link>
          <h1 className="mt-2 text-lg font-medium text-[#262626]">团队详情 · {data.tenantName}</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">平台管理视角（含厂商成本）</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded border border-[#d9d9d9] px-2 py-1 text-sm"
            value={data.period}
            onChange={(e) =>
              router.push(`/admin/teams/${tenantId}?period=${e.target.value}`)
            }
          >
            {data.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Link
            href={`/admin/teams/${tenantId}/billing/details`}
            className="rounded border border-[#d9d9d9] px-3 py-1 text-sm text-[#1890ff] hover:bg-[#fafafa]"
          >
            费用明细 →
          </Link>
        </div>
      </header>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-[#262626]">当前套餐</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <PackageItem label="套餐总积分" value={pkg.packageTotalCredits != null ? fmt(pkg.packageTotalCredits) : "—"} hint="通用+视频池" />
          <PackageItem label="套餐总金额（元）" value={fmtYuan(pkg.packageTotalPriceYuan)} />
          <PackageItem label="计费周期" value={pkg.packageIntervalLabel} />
          <PackageItem label="账期起始日" value={fmtDate(pkg.periodStartAt)} />
          <PackageItem label="到期日" value={pkg.periodEndAt ? fmtDate(pkg.periodEndAt) : "—"} hint="续费后顺延" />
          <PackageItem label="续期次数" value={String(pkg.renewalCount)} hint="含首期" />
          <PackageItem label="剩余积分" value={fmt(pkg.remainingCredits)} hint="通用+视频可用余额" />
          <PackageItem
            label="池明细"
            value={`${fmt(pkg.generalGrantCredits)} / ${fmt(pkg.videoGrantCredits)}`}
            hint="发放·通用/视频"
          />
        </dl>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="剩余积分" value={pkg.remainingCredits} />
        <Stat label="月消耗" value={dash.bill.consumed} />
        <Stat label="席位" value={dash.seatUsage.used} suffix={`/ ${dash.seatUsage.limit}`} />
        {dash.vendorCostYuan != null ? (
          <Stat label="厂商成本（元）" value={dash.vendorCostYuan} decimals />
        ) : null}
      </div>

      {dash.note ? <p className="text-xs text-[#8c8c8c]">{dash.note}</p> : null}

      {dash.tokenUsage ? (
        <FinanceTokenUsageSummaryPanel
          usage={dash.tokenUsage}
          periodKey={data.period}
        />
      ) : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">成员消耗</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#8c8c8c]">
              <th className="py-2">成员</th>
              <th className="py-2 text-right">本月消耗</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {dash.bill.members.map((m) => (
              <tr key={m.actorUserId} className="border-t border-[#f0f0f0]">
                <td className="py-2">{formatUserCellPrimary({ ...m, id: m.actorUserId })}</td>
                <td className="py-2 text-right">{fmt(m.consumed)}</td>
                <td className="py-2">
                  <Link
                    href={`/admin/teams/${tenantId}/members/${m.actorUserId}`}
                    className="text-[#1890ff] hover:underline text-xs"
                  >
                    溯源 →
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

function PackageItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
      <dt className="text-xs text-[#8c8c8c]">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-[#262626]">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[10px] text-[#bfbfbf]">{hint}</dd> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  decimals,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: boolean;
}) {
  return (
    <div className="rounded border border-[#e8e8e8] bg-white p-4">
      <p className="text-xs text-[#8c8c8c]">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        {decimals ? value.toFixed(2) : fmt(value)}
        {suffix ? <span className="text-sm font-normal text-[#8c8c8c]"> {suffix}</span> : null}
      </p>
    </div>
  );
}
