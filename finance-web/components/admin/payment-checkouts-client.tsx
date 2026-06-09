"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";

type PaymentRow = {
  id: string;
  remarkCode: string;
  outTradeNo: string;
  status: string;
  productLabel: string;
  amountYuan: number;
  confirmMode: string | null;
  paidAt: string | null;
  createdAt: string;
  user: { email: string | null; name: string | null };
  order: { id: string; amountYuan: number | null; type: string; status: string } | null;
  ledger: { type: string; credits: number; pool: string; createdAt: string } | null;
};

function fmtYuan(n: number) {
  return `¥${n.toFixed(2)}`;
}

export function PaymentCheckoutsClient() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<{ checkouts: PaymentRow[] }>(
      base,
      "/api/finance/admin/payments?limit=100",
    );
    if (r.ok) {
      setRows(r.data.checkouts);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [base]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">支付明细</h2>
        <p className="text-sm text-muted-foreground">
          微信个人收款 Checkout 与 Order 联查（含备注码、核对状态）。
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2">时间</th>
              <th className="px-3 py-2">备注码</th>
              <th className="px-3 py-2">用户</th>
              <th className="px-3 py-2">商品</th>
              <th className="px-3 py-2">金额</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">订单</th>
              <th className="px-3 py-2">积分流水</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  暂无支付记录
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2 font-mono">{r.remarkCode}</td>
                  <td className="px-3 py-2">{r.user.email ?? r.user.name}</td>
                  <td className="px-3 py-2">{r.productLabel}</td>
                  <td className="px-3 py-2">{fmtYuan(r.amountYuan)}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.order?.id ? `${r.order.id.slice(0, 10)}…` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.ledger
                      ? `${r.ledger.type} ${r.ledger.credits > 0 ? "+" : ""}${r.ledger.credits} (${r.ledger.pool})`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
