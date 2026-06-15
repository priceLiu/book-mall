"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";
import { formatUserCellPrimary } from "@/lib/user-contact-display";

type ByokBill = {
  periodKey: string;
  techServiceFeeYuan: number;
  resourceFeeYuan: number;
  totalYuan: number;
  resourceBreakdown: { resourceType: string; quantity: number; costYuan: number }[];
};

type TaskUsageRow = {
  taskKind: string;
  label: string;
  monthlyIncluded: number;
  includedUsed: number;
  includedRemaining: number;
  overageUsed: number;
  overageCredits: number;
  overageCreditsPerTask: number;
};

type MemberBreakdown = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  byTaskKind: { taskKind: string | null; label: string; count: number }[];
};

type ByokResponse = {
  periodKey: string;
  tenantName?: string;
  bill: ByokBill | null;
  message?: string;
  taskUsage?: TaskUsageRow[];
  memberBreakdown?: MemberBreakdown[];
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

type BillingByokClientProps = {
  scope?: "account" | "team";
  tenantId?: string;
};

export function BillingByokClient({ scope = "account", tenantId }: BillingByokClientProps) {
  const base = useBookMallBaseUrl();
  const searchParams = useSearchParams();
  const resolvedTenantId = tenantId ?? searchParams.get("tenantId") ?? undefined;
  const periods = recentPeriodKeys();
  const [periodKey, setPeriodKey] = useState(periods[0]);
  const [data, setData] = useState<ByokResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    const qs = new URLSearchParams({ periodKey });
    let path: string;
    if (scope === "team") {
      if (resolvedTenantId) qs.set("tenantId", resolvedTenantId);
      path = `/api/finance/team/byok-bill?${qs}`;
    } else {
      path = `/api/finance/account/byok-bill?${qs}`;
    }
    const r = await financeApiFetch<ByokResponse>(base, path);
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [base, periodKey, scope, resolvedTenantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return <FinancePageState>加载中…</FinancePageState>;

  const bill = data.bill;
  const taskUsage = data.taskUsage ?? [];
  const memberBreakdown = data.memberBreakdown ?? [];

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">
            {scope === "team" ? `团队 BYOK 任务用量${data.tenantName ? ` · ${data.tenantName}` : ""}` : "BYOK 任务用量"}
          </h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            套餐内次数按自然月累计；超额从轻量包按固定积分扣分。
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

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">本月任务额度（{periodKey}）</h2>
        {taskUsage.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[#8c8c8c]">
                <th className="py-2">任务</th>
                <th className="py-2 text-right">套餐内已用</th>
                <th className="py-2 text-right">套餐内剩余</th>
                <th className="py-2 text-right">超额次数</th>
                <th className="py-2 text-right">超额扣分</th>
              </tr>
            </thead>
            <tbody>
              {taskUsage.map((u) => (
                <tr key={u.taskKind} className="border-b border-[#f0f0f0]">
                  <td className="py-2">
                    {u.label}
                    <span className="ml-1 text-xs text-[#8c8c8c]">（含 {u.monthlyIncluded} 次/月）</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {u.includedUsed} / {u.monthlyIncluded}
                  </td>
                  <td className="py-2 text-right tabular-nums">{u.includedRemaining}</td>
                  <td className="py-2 text-right tabular-nums">{u.overageUsed}</td>
                  <td className="py-2 text-right tabular-nums">{u.overageCredits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[#8c8c8c]">{data.message ?? "暂无记录"}</p>
        )}
      </section>

      {scope === "team" && memberBreakdown.length > 0 ? (
        <section className="rounded border border-[#e8e8e8] bg-white p-4">
          <h2 className="mb-3 text-sm font-medium">成员 BYOK 调用</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[#8c8c8c]">
                <th className="py-2">成员</th>
                <th className="py-2">任务分布</th>
              </tr>
            </thead>
            <tbody>
              {memberBreakdown.map((m) => (
                <tr key={m.userId} className="border-b border-[#f0f0f0]">
                  <td className="py-2">{formatUserCellPrimary({ ...m, id: m.userId })}</td>
                  <td className="py-2 text-xs text-[#595959]">
                    {m.byTaskKind.map((t) => `${t.label}×${t.count}`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {!bill ? (
        <p className="text-sm text-[#8c8c8c]">{data.message ?? "无有效 BYOK 套餐"}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="技术服务费" yuan={bill.techServiceFeeYuan} />
          <StatCard label="本月应付" yuan={bill.totalYuan} highlight />
        </div>
      )}
    </FinancePageShell>
  );
}

function StatCard({
  label,
  yuan,
  highlight,
}: {
  label: string;
  yuan: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded border bg-white p-4 ${highlight ? "border-[#1890ff]" : "border-[#e8e8e8]"}`}>
      <p className="text-xs text-[#8c8c8c]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#262626]">¥{yuan.toFixed(2)}</p>
    </div>
  );
}
