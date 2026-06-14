"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";

type LedgerRow = {
  id: string;
  type: string;
  credits: number;
  balanceAfter: number;
  pool: string;
  actorUserId: string | null;
  refType: string | null;
  refId: string | null;
  description: string | null;
  staffFlag: boolean;
  billingPersonaSnap: string | null;
  createdAt: string;
};

type LedgerResponse = {
  rows: LedgerRow[];
  total: number;
  tenantId?: string;
  tenantName?: string;
};

const TYPE_LABEL: Record<string, string> = {
  GRANT: "发放",
  CONSUME: "消耗",
  REFUND: "返还",
  EXPIRE: "过期清零",
  TOPUP: "充值",
  ADJUST: "人工校正",
  RESERVE: "冻结",
  SETTLE: "结算",
  RELEASE: "解冻",
};

const PERSONA_LABEL: Record<string, string> = {
  PLATFORM_CREDIT: "平台代付",
  BYOK: "自带 Key",
};

type BillingLedgerClientProps = {
  scope?: "account" | "team";
  tenantId?: string;
  actorUserId?: string;
};

export function BillingLedgerClient({
  scope = "account",
  tenantId,
  actorUserId,
}: BillingLedgerClientProps) {
  const base = useBookMallBaseUrl();
  const searchParams = useSearchParams();
  const resolvedTenantId = tenantId ?? searchParams.get("tenantId") ?? undefined;
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    const qs = new URLSearchParams({ take: "100" });
    let path: string;
    if (scope === "team") {
      if (resolvedTenantId) qs.set("tenantId", resolvedTenantId);
      if (actorUserId) qs.set("actorUserId", actorUserId);
      path = `/api/finance/team/ledger?${qs}`;
    } else {
      path = `/api/finance/account/ledger?${qs}`;
    }
    const r = await financeApiFetch<LedgerResponse>(base, path);
    if (r.ok) {
      setRows(r.data.rows);
      setTotal(r.data.total);
      setTenantName(r.data.tenantName ?? null);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [base, scope, resolvedTenantId, actorUserId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!rows.length && !error) return <FinancePageState>加载中…</FinancePageState>;

  return (
    <FinancePageShell>
      <header>
        <h1 className="text-lg font-medium text-[#262626]">
          {scope === "team" ? `团队积分流水${tenantName ? ` · ${tenantName}` : ""}` : "积分流水"}
        </h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          CreditLedger 明细 · 共 {total} 条（展示最近 100 条）
        </p>
      </header>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[#8c8c8c]">
              <th className="py-2 pr-3">时间</th>
              <th className="py-2 pr-3">类型</th>
              <th className="py-2 pr-3 text-right">积分</th>
              <th className="py-2 pr-3 text-right">余额后</th>
              {scope === "team" ? <th className="py-2 pr-3">操作人</th> : null}
              <th className="py-2 pr-3">池</th>
              <th className="py-2">说明</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#f0f0f0]">
                <td className="py-2 pr-3 text-xs text-[#8c8c8c]">
                  {new Date(row.createdAt).toLocaleString("zh-CN")}
                </td>
                <td className="py-2 pr-3">{TYPE_LABEL[row.type] ?? row.type}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.credits}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.balanceAfter}</td>
                {scope === "team" ? (
                  <td className="py-2 pr-3 font-mono text-xs">{row.actorUserId?.slice(0, 8) ?? "—"}</td>
                ) : null}
                <td className="py-2 pr-3">{row.pool}</td>
                <td className="py-2 max-w-xs truncate" title={row.description ?? undefined}>
                  {row.description ?? "—"}
                  {row.billingPersonaSnap ? (
                    <span className="ml-1 text-xs text-[#8c8c8c]">
                      ({PERSONA_LABEL[row.billingPersonaSnap] ?? row.billingPersonaSnap})
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </FinancePageShell>
  );
}
