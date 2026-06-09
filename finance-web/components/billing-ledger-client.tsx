"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
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

export function BillingLedgerClient() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<LedgerResponse>(base, "/api/finance/account/ledger?take=100");
    if (r.ok) {
      setRows(r.data.rows);
      setTotal(r.data.total);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!rows.length && !error) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-lg font-medium text-[#262626]">积分流水</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          CreditLedger 明细 · 共 {total} 条（展示最近 100 条）
        </p>
      </header>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[#8c8c8c]">
              <th className="py-2">时间</th>
              <th className="py-2">类型</th>
              <th className="py-2">池</th>
              <th className="py-2">身份</th>
              <th className="py-2 text-right">变动</th>
              <th className="py-2 text-right">余额</th>
              <th className="py-2">说明</th>
              <th className="py-2">关联</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#f0f0f0]">
                <td className="py-2 text-xs text-[#8c8c8c]">
                  {new Date(r.createdAt).toLocaleString("zh-CN")}
                </td>
                <td className="py-2">{TYPE_LABEL[r.type] ?? r.type}</td>
                <td className="py-2">{r.pool}</td>
                <td className="py-2">
                  {r.billingPersonaSnap
                    ? (PERSONA_LABEL[r.billingPersonaSnap] ?? r.billingPersonaSnap)
                    : "—"}
                  {r.staffFlag ? (
                    <span className="ml-1 rounded bg-amber-50 px-1 text-xs text-amber-700">员工</span>
                  ) : null}
                </td>
                <td className="py-2 text-right font-medium">
                  {r.credits > 0 ? "+" : ""}
                  {r.credits.toLocaleString("zh-CN")}
                </td>
                <td className="py-2 text-right">{r.balanceAfter.toLocaleString("zh-CN")}</td>
                <td className="py-2 text-xs text-[#8c8c8c]">{r.description ?? "—"}</td>
                <td className="py-2 text-xs text-[#8c8c8c]">
                  {r.refType ? (
                    <span title={r.refId ?? undefined}>
                      {r.refType}
                      {r.refId ? ` · ${r.refId.slice(0, 8)}…` : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
