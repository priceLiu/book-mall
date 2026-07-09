"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type PreviewRow = {
  referrerUserId: string;
  referrerName: string | null;
  referrerPhoneMasked: string;
  code: string;
  enabled: boolean;
  commissionRate: number;
  referredCount: number;
  planAmountYuan: number;
  rechargeAmountYuan: number;
  baseAmountYuan: number;
  commissionYuan: number;
  existingStatus: "PENDING" | "PAID" | "VOID" | null;
};

type PayoutRow = {
  id: string;
  referrerName: string | null;
  referrerPhoneMasked: string;
  periodKey: string;
  commissionRate: number;
  planAmountYuan: number;
  rechargeAmountYuan: number;
  baseAmountYuan: number;
  commissionYuan: number;
  referredCount: number;
  status: "PENDING" | "PAID" | "VOID";
  note: string | null;
  paidAt: string | null;
  createdAt: string;
};

function yuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 默认上个月 YYYY-MM */
function lastMonthKey(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<PayoutRow["status"], string> = {
  PENDING: "待支付",
  PAID: "已支付",
  VOID: "已作废",
};

function downloadCsv(filename: string, rows: PayoutRow[]) {
  const header = [
    "结算周期",
    "分享人",
    "手机",
    "下线活跃数",
    "套餐实付",
    "充值实付",
    "计算基数",
    "返佣比例",
    "应返佣金",
    "状态",
    "打款时间",
    "备注",
  ];
  const lines = rows.map((r) =>
    [
      r.periodKey,
      r.referrerName ?? "",
      r.referrerPhoneMasked,
      r.referredCount,
      r.planAmountYuan.toFixed(2),
      r.rechargeAmountYuan.toFixed(2),
      r.baseAmountYuan.toFixed(2),
      `${(r.commissionRate * 100).toFixed(2)}%`,
      r.commissionYuan.toFixed(2),
      STATUS_LABEL[r.status],
      r.paidAt ? new Date(r.paidAt).toLocaleString("zh-CN") : "",
      (r.note ?? "").replace(/[\n,]/g, " "),
    ].join(","),
  );
  const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReferralPayoutsClient() {
  const base = useBookMallBaseUrl();
  const [periodKey, setPeriodKey] = useState(lastMonthKey());
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadPayouts = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<{ payouts: PayoutRow[] }>(
      base,
      `/api/finance/admin/referral-payouts/list?periodKey=${encodeURIComponent(periodKey)}`,
    );
    if (r.ok) setPayouts(r.data.payouts);
    else setErr(r.error);
  }, [base, periodKey]);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  const runPreview = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setMsg(null);
    setErr(null);
    const r = await financeApiPost<{ periodKey: string; rows: PreviewRow[] }>(
      base,
      "/api/finance/admin/referral-payouts/preview",
      { periodKey },
    );
    setLoading(false);
    if (r.ok) setPreview(r.data.rows);
    else setErr(r.error);
  }, [base, periodKey]);

  const generate = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setMsg(null);
    const r = await financeApiPost<{
      ok: boolean;
      created: number;
      updated: number;
      skipped: number;
      error?: string;
    }>(base, "/api/finance/admin/referral-payouts/generate", { periodKey });
    setLoading(false);
    if (r.ok) {
      setMsg(`已生成返佣单：新增 ${r.data.created} · 刷新 ${r.data.updated} · 跳过 ${r.data.skipped}`);
      void loadPayouts();
    } else {
      setErr(r.error);
    }
  }, [base, periodKey, loadPayouts]);

  const setStatus = useCallback(
    async (id: string, status: PayoutRow["status"]) => {
      if (!base) return;
      const r = await financeApiPost<{ ok: boolean; error?: string }>(
        base,
        "/api/finance/admin/referral-payouts/status",
        { id, status },
      );
      if (r.ok) void loadPayouts();
      else setErr(r.error);
    },
    [base, loadPayouts],
  );

  const previewCommission = preview
    ? preview.reduce((s, r) => s + r.commissionYuan, 0)
    : 0;
  const payoutTotal = payouts.reduce((s, r) => s + r.commissionYuan, 0);
  const payoutPending = payouts
    .filter((r) => r.status === "PENDING")
    .reduce((s, r) => s + r.commissionYuan, 0);

  if (!base) {
    return <FinancePageState variant="error">未配置主站地址。</FinancePageState>;
  }

  return (
    <FinancePageShell>
      <h1 className="text-lg font-medium text-[#262626]">分享返佣结算 · 返佣单</h1>

      <div className="rounded border border-[#e8e8e8] bg-[#fafcff] p-3 text-xs leading-relaxed text-[#595959]">
        <p className="font-medium text-[#262626]">返佣怎么返 / 何时返</p>
        <p className="mt-1">
          · 计算基数：下线用户在结算周期内 <b>实付</b>（订单已支付）的「套餐订阅 + 轻量包充值」金额合计。
        </p>
        <p>· 应返佣金 = 计算基数 × 分享人当前返佣比例（出单时定格快照）。</p>
        <p>· 结算节奏：按自然月出单（次月结算上月）；也可选任意月份手动计算。</p>
        <p>
          · 流程：选周期 → <b>计算</b>（预览）→ <b>生成返佣单</b>（待支付）→ 线下打款后
          <b>标记已支付</b>；可<b>导出 CSV</b> 作为打款依据。已支付/作废不被重新生成覆盖。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[#595959]">结算周期</span>
          <input
            type="month"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="rounded border border-[#d9d9d9] px-2 py-1 text-sm focus:border-[#1890ff] focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={loading}
          className="rounded border border-[#1890ff] px-3 py-1.5 text-sm text-[#1890ff] hover:bg-[#e6f7ff] disabled:opacity-50"
        >
          {loading ? "计算中…" : "计算"}
        </button>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white hover:bg-[#40a9ff] disabled:opacity-50"
        >
          生成返佣单
        </button>
        <button
          type="button"
          onClick={() => downloadCsv(`返佣单_${periodKey}.csv`, payouts)}
          disabled={payouts.length === 0}
          className="rounded border border-[#d9d9d9] px-3 py-1.5 text-sm hover:border-[#1890ff] disabled:opacity-50"
        >
          导出返佣单 CSV
        </button>
      </div>

      {msg ? <div className="text-sm text-[#52c41a]">{msg}</div> : null}
      {err ? <div className="text-sm text-[#cf1322]">加载/操作失败：{err}</div> : null}

      {preview ? (
        <div className="space-y-2">
          <div className="text-sm text-[#262626]">
            计算结果（{periodKey}）：{preview.length} 位分享人 · 应返合计{" "}
            <b className="text-[#52c41a]">{yuan(previewCommission)}</b>
          </div>
          <div className="overflow-x-auto rounded border border-[#e8e8e8]">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-[#e8e8e8] bg-[#fafafa] text-left text-xs text-[#595959]">
                  <th className="px-3 py-2 font-medium">分享人</th>
                  <th className="px-3 py-2 text-right font-medium">活跃下线</th>
                  <th className="px-3 py-2 text-right font-medium">套餐实付</th>
                  <th className="px-3 py-2 text-right font-medium">充值实付</th>
                  <th className="px-3 py-2 text-right font-medium">基数</th>
                  <th className="px-3 py-2 text-right font-medium">比例</th>
                  <th className="px-3 py-2 text-right font-medium">应返佣金</th>
                  <th className="px-3 py-2 font-medium">已出单</th>
                </tr>
              </thead>
              <tbody>
                {preview.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-[#8c8c8c]">
                      该周期无可结算返佣
                    </td>
                  </tr>
                ) : (
                  preview.map((r) => (
                    <tr key={r.referrerUserId} className="border-b border-[#f0f0f0] last:border-0">
                      <td className="px-3 py-2">
                        <div>{r.referrerName || "未设置昵称"}</div>
                        <div className="text-xs text-[#8c8c8c]">
                          {r.referrerPhoneMasked} · {r.code}
                          {!r.enabled ? " · 已停用" : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{r.referredCount}</td>
                      <td className="px-3 py-2 text-right">{yuan(r.planAmountYuan)}</td>
                      <td className="px-3 py-2 text-right">{yuan(r.rechargeAmountYuan)}</td>
                      <td className="px-3 py-2 text-right">{yuan(r.baseAmountYuan)}</td>
                      <td className="px-3 py-2 text-right">
                        {(r.commissionRate * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-[#52c41a]">
                        {yuan(r.commissionYuan)}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#8c8c8c]">
                        {r.existingStatus ? STATUS_LABEL[r.existingStatus] : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-4 text-sm text-[#262626]">
          <span>返佣单：{payouts.length} 张</span>
          <span>合计：{yuan(payoutTotal)}</span>
          <span>待支付：{yuan(payoutPending)}</span>
        </div>
        <div className="overflow-x-auto rounded border border-[#e8e8e8]">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-[#e8e8e8] bg-[#fafafa] text-left text-xs text-[#595959]">
                <th className="px-3 py-2 font-medium">周期</th>
                <th className="px-3 py-2 font-medium">分享人</th>
                <th className="px-3 py-2 text-right font-medium">基数</th>
                <th className="px-3 py-2 text-right font-medium">比例</th>
                <th className="px-3 py-2 text-right font-medium">应返佣金</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[#8c8c8c]">
                    暂无返佣单（先「计算」再「生成返佣单」）
                  </td>
                </tr>
              ) : (
                payouts.map((r) => (
                  <tr key={r.id} className="border-b border-[#f0f0f0] last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{r.periodKey}</td>
                    <td className="px-3 py-2">
                      <div>{r.referrerName || "未设置昵称"}</div>
                      <div className="text-xs text-[#8c8c8c]">{r.referrerPhoneMasked}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{yuan(r.baseAmountYuan)}</td>
                    <td className="px-3 py-2 text-right">{(r.commissionRate * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-medium text-[#52c41a]">
                      {yuan(r.commissionYuan)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "PAID"
                            ? "text-[#52c41a]"
                            : r.status === "VOID"
                              ? "text-[#8c8c8c] line-through"
                              : "text-[#fa8c16]"
                        }
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {r.status !== "PAID" ? (
                          <button
                            type="button"
                            onClick={() => void setStatus(r.id, "PAID")}
                            className="rounded bg-[#52c41a] px-2 py-1 text-xs text-white hover:bg-[#73d13d]"
                          >
                            标记已支付
                          </button>
                        ) : null}
                        {r.status !== "VOID" ? (
                          <button
                            type="button"
                            onClick={() => void setStatus(r.id, "VOID")}
                            className="rounded border border-[#d9d9d9] px-2 py-1 text-xs hover:border-[#cf1322] hover:text-[#cf1322]"
                          >
                            作废
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void setStatus(r.id, "PENDING")}
                            className="rounded border border-[#d9d9d9] px-2 py-1 text-xs hover:border-[#1890ff]"
                          >
                            恢复待支付
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </FinancePageShell>
  );
}
