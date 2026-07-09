"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type ReferralRow = {
  referrerUserId: string;
  referrerName: string | null;
  referrerPhoneMasked: string;
  code: string;
  enabled: boolean;
  commissionRate: number;
  referredCount: number;
  totalPlanAmountYuan: number;
  totalRechargeAmountYuan: number;
  totalAmountYuan: number;
  estimatedCommissionYuan: number;
  note: string | null;
  rateUpdatedAt: string | null;
  rateUpdatedBy: string | null;
  createdAt: string;
};

type Draft = { ratePct: string; note: string; enabled: boolean };

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1 text-sm focus:border-[#1890ff] focus:outline-none";

function yuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 返佣反算工具（保守满额消耗口径）：最大返佣% = 产品毛利% − 目标毛利下限%。
 * 全局最低毛利产品 ≈ 视频加量包 25.9%，作为单一统一返佣的兜底约束。
 */
const LOWEST_PRODUCT_MARGIN_PCT = 25.9; // 视频加量包（保守：视频成本 ¥0.0267/积分）
const PRODUCT_MARGIN_REFERENCE: { label: string; marginPct: number }[] = [
  { label: "个人月付（标准~至尊）", marginPct: 54.6 },
  { label: "个人年付（至尊，最低）", marginPct: 45.6 },
  { label: "团队年付（至尊，最低）", marginPct: 27.5 },
  { label: "通用加油包（最低）", marginPct: 57.9 },
  { label: "视频加油包（视频加量，全局最低）", marginPct: 25.9 },
];

function ReferralCommissionCalc() {
  const [targetPct, setTargetPct] = useState("20");
  const target = Number(targetPct);
  const validTarget = Number.isFinite(target) && target >= 0 && target < 100;
  const uniformMax = validTarget
    ? Math.max(0, Math.round((LOWEST_PRODUCT_MARGIN_PCT - target) * 10) / 10)
    : 0;

  return (
    <details className="rounded border border-[#e8e8e8] bg-[#fafcff] p-3 text-sm text-[#262626]">
      <summary className="cursor-pointer font-medium text-[#262626]">
        返佣反算工具（按目标毛利算最大返佣）
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-[#595959]">目标毛利下限(%)</label>
        <input
          type="number"
          min={0}
          max={99}
          step={1}
          value={targetPct}
          onChange={(e) => setTargetPct(e.target.value)}
          className={`${inputCls} w-24`}
        />
        <span className="text-[#8c8c8c]">→</span>
        <span className="font-medium text-[#52c41a]">
          单一统一返佣上限 ≈ {uniformMax}%
        </span>
        <span className="text-xs text-[#8c8c8c]">
          （由全局最低毛利产品 {LOWEST_PRODUCT_MARGIN_PCT}% 兜底）
        </span>
      </div>
      <p className="mt-2 text-xs text-[#8c8c8c]">
        推荐：保 20% 毛利 → 返 5%；保 15% 毛利 → 返 10%。以下为各产品毛利与该目标下的逐档上限（设计支持逐档，当前统一取一个值）。
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-xs">
          <thead>
            <tr className="border-b border-[#e8e8e8] bg-white text-left text-[#595959]">
              <th className="px-2 py-1 font-medium">产品</th>
              <th className="px-2 py-1 text-right font-medium">毛利</th>
              <th className="px-2 py-1 text-right font-medium">该目标下最大返佣</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCT_MARGIN_REFERENCE.map((p) => {
              const max = validTarget
                ? Math.max(0, Math.round((p.marginPct - target) * 10) / 10)
                : 0;
              return (
                <tr key={p.label} className="border-b border-[#f0f0f0] last:border-0">
                  <td className="px-2 py-1">{p.label}</td>
                  <td className="px-2 py-1 text-right">{p.marginPct}%</td>
                  <td className="px-2 py-1 text-right text-[#52c41a]">{max}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ReferralsClient() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setError(null);
    const r = await financeApiFetch<{ referrals: ReferralRow[] }>(
      base,
      "/api/finance/admin/referrals",
    );
    if (r.ok) {
      setRows(r.data.referrals);
      const next: Record<string, Draft> = {};
      for (const row of r.data.referrals) {
        next[row.referrerUserId] = {
          ratePct:
            row.commissionRate > 0
              ? String(Math.round(row.commissionRate * 10000) / 100)
              : "",
          note: row.note ?? "",
          enabled: row.enabled,
        };
      }
      setDrafts(next);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setDraft = useCallback(
    (id: string, patch: Partial<Draft>) => {
      setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    },
    [],
  );

  const save = useCallback(
    async (id: string) => {
      if (!base) return;
      const d = drafts[id];
      if (!d) return;
      const pct = d.ratePct.trim() === "" ? 0 : Number(d.ratePct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        setMsg("返佣比例需为 0~100 的百分比");
        return;
      }
      setSavingId(id);
      setMsg(null);
      const r = await financeApiPost<{ ok: boolean; error?: string }>(
        base,
        "/api/finance/admin/referrals/rate",
        {
          referrerUserId: id,
          rate: Math.round((pct / 100) * 10000) / 10000,
          note: d.note,
          enabled: d.enabled,
        },
      );
      setSavingId(null);
      if (r.ok) {
        setMsg("已保存");
        void reload();
      } else {
        setMsg(r.error);
      }
    },
    [base, drafts, reload],
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.referred += r.referredCount;
        acc.amount += r.totalAmountYuan;
        acc.commission += r.estimatedCommissionYuan;
        return acc;
      },
      { referred: 0, amount: 0, commission: 0 },
    );
  }, [rows]);

  if (loading) return <FinancePageState>加载中…</FinancePageState>;
  if (error)
    return <FinancePageState variant="error">加载失败：{error}</FinancePageState>;

  return (
    <FinancePageShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-medium text-[#262626]">分享返佣管理</h1>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded border border-[#d9d9d9] px-3 py-1 text-sm hover:border-[#1890ff]"
        >
          刷新
        </button>
      </div>

      <p className="text-xs text-[#8c8c8c]">
        分享门槛（分享链接 1.0）：任意有效订阅（个人套餐或团队主账号）；团队下的普通成员不可分享。
        返佣比例由财务录入（0~100%），金额按下线「套餐消费 + 充值消费」实付汇总；预估返佣 = 总消费 × 比例。
      </p>

      <ReferralCommissionCalc />

      <div className="flex flex-wrap gap-4 text-sm text-[#262626]">
        <span>分享人：{rows.length}</span>
        <span>累计邀请：{totals.referred} 人</span>
        <span>下线总消费：{yuan(totals.amount)}</span>
        <span>预估返佣合计：{yuan(totals.commission)}</span>
      </div>

      {msg ? <div className="text-sm text-[#1890ff]">{msg}</div> : null}

      <div className="overflow-x-auto rounded border border-[#e8e8e8]">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b border-[#e8e8e8] bg-[#fafafa] text-left text-xs text-[#595959]">
              <th className="px-3 py-2 font-medium">分享人</th>
              <th className="px-3 py-2 font-medium">分享码</th>
              <th className="px-3 py-2 text-right font-medium">邀请</th>
              <th className="px-3 py-2 text-right font-medium">套餐消费</th>
              <th className="px-3 py-2 text-right font-medium">充值消费</th>
              <th className="px-3 py-2 text-right font-medium">总消费</th>
              <th className="px-3 py-2 font-medium">返佣比例(%)</th>
              <th className="px-3 py-2 text-right font-medium">预估返佣</th>
              <th className="px-3 py-2 font-medium">启用</th>
              <th className="px-3 py-2 font-medium">备注</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-[#8c8c8c]">
                  暂无分享人
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const d = drafts[r.referrerUserId] ?? {
                  ratePct: "",
                  note: "",
                  enabled: r.enabled,
                };
                return (
                  <tr
                    key={r.referrerUserId}
                    className="border-b border-[#f0f0f0] last:border-0 text-[#262626]"
                  >
                    <td className="px-3 py-2">
                      <div>{r.referrerName || "未设置昵称"}</div>
                      <div className="text-xs text-[#8c8c8c]">
                        {r.referrerPhoneMasked}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-3 py-2 text-right">{r.referredCount}</td>
                    <td className="px-3 py-2 text-right">
                      {yuan(r.totalPlanAmountYuan)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {yuan(r.totalRechargeAmountYuan)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {yuan(r.totalAmountYuan)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={d.ratePct}
                        placeholder="未设置"
                        onChange={(e) =>
                          setDraft(r.referrerUserId, { ratePct: e.target.value })
                        }
                        className={`${inputCls} w-20`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-[#52c41a]">
                      {yuan(r.estimatedCommissionYuan)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) =>
                          setDraft(r.referrerUserId, { enabled: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={d.note}
                        placeholder="结算口径等"
                        onChange={(e) =>
                          setDraft(r.referrerUserId, { note: e.target.value })
                        }
                        className={`${inputCls} w-40`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={savingId === r.referrerUserId}
                        onClick={() => void save(r.referrerUserId)}
                        className="rounded bg-[#1890ff] px-3 py-1 text-xs text-white hover:bg-[#40a9ff] disabled:opacity-50"
                      >
                        {savingId === r.referrerUserId ? "保存中…" : "保存"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </FinancePageShell>
  );
}
