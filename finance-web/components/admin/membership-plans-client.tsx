"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type Plan = {
  id: string;
  family: string;
  interval: string;
  tier: string;
  sortOrder: number;
  priceYuan: number;
  originalYuan: number | null;
  promoLabel: string | null;
  monthlyCredits: number;
  videoMonthlyCredits: number;
  includedSeats: number;
  active: boolean;
  seatTiers: Array<{
    id: string;
    planId: string;
    seatMin: number;
    seatMax: number | null;
    perSeatPriceYuan: number;
    perSeatCredits: number;
    sortOrder: number;
  }>;
};

const FAMILY_LABEL: Record<string, string> = { PERSONAL: "个人", TEAM: "团队" };
const INTERVAL_LABEL: Record<string, string> = { MONTH: "月付", YEAR: "年付" };
const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

const EMPTY = {
  family: "PERSONAL",
  interval: "MONTH",
  tier: "标准版",
  sortOrder: 1,
  priceYuan: 0,
  originalYuan: "",
  promoLabel: "",
  monthlyCredits: 0,
  videoMonthlyCredits: 0,
  includedSeats: 1,
  active: true,
};

export function MembershipPlansClient() {
  const base = useBookMallBaseUrl();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const r = await financeApiFetch<{ plans: Plan[] }>(base, "/api/finance/admin/membership-plans");
    if (r.ok) setPlans(r.data.plans);
    else setError(r.error);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function submit() {
    if (!base) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      action: "upsertPlan",
      family: draft.family,
      interval: draft.interval,
      tier: draft.tier,
      sortOrder: draft.sortOrder,
      priceYuan: draft.priceYuan,
      monthlyCredits: draft.monthlyCredits,
      videoMonthlyCredits: draft.videoMonthlyCredits,
      includedSeats: draft.includedSeats,
      active: draft.active,
    };
    if (editingId) body.id = editingId;
    if (draft.originalYuan) body.originalYuan = Number(draft.originalYuan);
    if (draft.promoLabel) body.promoLabel = draft.promoLabel;
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/membership-plans", body);
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "保存失败") : r.error);
    else {
      setMsg("已保存");
      setEditingId(null);
      setDraft(EMPTY);
      reload();
    }
  }

  if (loading) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-medium">会员套餐与席位带</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">仅财务管理员可维护。保存后对外报价页即时生效。</p>
      </header>
      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">{editingId ? "编辑套餐" : "新增套餐"}</h2>
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="text-[#8c8c8c]">类型</span>
            <select className={inputCls} value={draft.family} onChange={(e) => setDraft({ ...draft, family: e.target.value })}>
              <option value="PERSONAL">个人</option>
              <option value="TEAM">团队</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">周期</span>
            <select className={inputCls} value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value })}>
              <option value="MONTH">月付</option>
              <option value="YEAR">年付</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">档位名</span>
            <input className={inputCls} value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">价格（元）</span>
            <input type="number" className={inputCls} value={draft.priceYuan} onChange={(e) => setDraft({ ...draft, priceYuan: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">月积分</span>
            <input type="number" className={inputCls} value={draft.monthlyCredits} onChange={(e) => setDraft({ ...draft, monthlyCredits: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">视频池积分</span>
            <input type="number" className={inputCls} value={draft.videoMonthlyCredits} onChange={(e) => setDraft({ ...draft, videoMonthlyCredits: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">含席位数</span>
            <input type="number" className={inputCls} value={draft.includedSeats} onChange={(e) => setDraft({ ...draft, includedSeats: Number(e.target.value) })} />
          </label>
        </div>
        <button type="button" onClick={submit} disabled={saving} className="mt-3 rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white">
          保存
        </button>
      </section>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2 text-left">套餐</th>
              <th className="px-3 py-2 text-right">价格</th>
              <th className="px-3 py-2 text-right">月积分</th>
              <th className="px-3 py-2 text-right">视频池</th>
              <th className="px-3 py-2 text-right">席位</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  {FAMILY_LABEL[p.family]} · {INTERVAL_LABEL[p.interval]} · {p.tier}
                  {p.seatTiers.length > 0 ? (
                    <span className="ml-1 text-xs text-purple-600">({p.seatTiers.length} 席位带)</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">¥{p.priceYuan.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{p.monthlyCredits}</td>
                <td className="px-3 py-2 text-right">{p.videoMonthlyCredits}</td>
                <td className="px-3 py-2 text-right">{p.includedSeats}</td>
                <td className="px-3 py-2">{p.active ? "生效" : "停用"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-[#1890ff] hover:underline"
                    onClick={() => {
                      setEditingId(p.id);
                      setDraft({
                        family: p.family,
                        interval: p.interval,
                        tier: p.tier,
                        sortOrder: p.sortOrder,
                        priceYuan: p.priceYuan,
                        originalYuan: p.originalYuan != null ? String(p.originalYuan) : "",
                        promoLabel: p.promoLabel ?? "",
                        monthlyCredits: p.monthlyCredits,
                        videoMonthlyCredits: p.videoMonthlyCredits,
                        includedSeats: p.includedSeats,
                        active: p.active,
                      });
                    }}
                  >
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
