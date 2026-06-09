"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  computeCreditPrice,
  computeEffectiveMargin,
  computeTierGenerations,
  unitLabel,
  type PricingConfig,
} from "@/lib/credit-pricing-formulas";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type ModelInput = {
  canonicalModelKey: string;
  vendor: string;
  channel: string;
  unit: string;
  tierRaw: string | null;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
};

type PublishedPrice = {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
  listPriceYuan: number;
  baseMarginRate: number;
  marginM: number;
  active: boolean;
  publishedAt: string;
};

type PlanLite = {
  family: string;
  interval: string;
  tier: string;
  priceYuan: number;
  monthlyCredits: number;
};

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function CreditPricingClient() {
  const base = useBookMallBaseUrl();
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [models, setModels] = useState<ModelInput[]>([]);
  const [published, setPublished] = useState<PublishedPrice[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [anchor, setAnchor] = useState(0.04);
  const [marginM, setMarginM] = useState(2.5);
  const [minGuard, setMinGuard] = useState(0.3);
  const [videoSec, setVideoSec] = useState(15);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const r = await financeApiFetch<{
      config: PricingConfig;
      models: ModelInput[];
      published: PublishedPrice[];
      plans: PlanLite[];
    }>(base, "/api/finance/admin/credit-pricing");
    if (r.ok) {
      setConfig(r.data.config);
      setModels(r.data.models);
      setPublished(r.data.published);
      setPlans(r.data.plans);
      setAnchor(r.data.config.creditAnchorYuan);
      setMarginM(r.data.config.defaultMarginM);
      setMinGuard(r.data.config.minMarginGuard);
      setVideoSec(r.data.config.defaultVideoSec);
      if (!selectedKey && r.data.models[0]) setSelectedKey(r.data.models[0].canonicalModelKey);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base, selectedKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = models.find((m) => m.canonicalModelKey === selectedKey);
  const comp = useMemo(() => {
    if (!selected) return null;
    return computeCreditPrice({
      listCostYuan: selected.listCostYuan,
      discountRate: selected.discountRate,
      marginM,
      anchorYuan: anchor,
    });
  }, [selected, marginM, anchor]);

  const belowGuard = comp ? comp.baseMarginRate < minGuard : false;
  const personalPlans = plans.filter((p) => p.family === "PERSONAL" && p.interval === "MONTH");

  async function saveConfig() {
    if (!base) return;
    setSaving(true);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/credit-pricing", {
      action: "saveConfig",
      creditAnchorYuan: anchor,
      defaultMarginM: marginM,
      minMarginGuard: minGuard,
      defaultVideoSec: videoSec,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "保存失败") : r.error);
    else setMsg("全局参数已保存");
  }

  async function publish() {
    if (!base || !selected) return;
    setSaving(true);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/credit-pricing", {
      action: "publish",
      canonicalModelKey: selected.canonicalModelKey,
      displayName: displayName || selected.canonicalModelKey,
      marginM,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "发布失败") : r.error);
    else {
      setMsg("已发布");
      reload();
    }
  }

  async function unpublish(key: string) {
    if (!base) return;
    setSaving(true);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/credit-pricing", {
      action: "unpublish",
      canonicalModelKey: key,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "下架失败") : r.error);
    else reload();
  }

  if (loading) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-medium">积分报价计算器</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          仅财务管理员可见。实时计算挂牌价与毛利，确认后发布到对外报价。
        </p>
      </header>
      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">全局参数</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="text-[#8c8c8c]">积分锚定（元）</span>
            <input type="number" step="0.01" className={inputCls} value={anchor} onChange={(e) => setAnchor(Number(e.target.value))} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">默认系数 M</span>
            <input type="number" step="0.1" className={inputCls} value={marginM} onChange={(e) => setMarginM(Number(e.target.value))} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">毛利护栏</span>
            <input type="number" step="0.05" className={inputCls} value={minGuard} onChange={(e) => setMinGuard(Number(e.target.value))} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">视频封顶秒数</span>
            <input type="number" className={inputCls} value={videoSec} onChange={(e) => setVideoSec(Number(e.target.value))} />
          </label>
        </div>
        <button type="button" onClick={saveConfig} disabled={saving} className="mt-3 rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white">
          保存全局参数
        </button>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border border-[#e8e8e8] bg-white p-4">
          <h2 className="mb-2 text-sm font-medium">选择模型</h2>
          <select className={inputCls} value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
            {models.map((m) => (
              <option key={m.canonicalModelKey} value={m.canonicalModelKey}>
                {m.canonicalModelKey} ({m.vendor})
              </option>
            ))}
          </select>
          {comp && selected ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>净成本 ¥{comp.netCostYuan.toFixed(4)} · 挂牌 ¥{comp.listPriceYuan.toFixed(4)}</p>
              <p>
                积分/{unitLabel(selected.unit)}：{comp.creditsPerUnit} · 标准毛利 {(comp.baseMarginRate * 100).toFixed(1)}%
                {belowGuard ? <span className="ml-2 text-red-600">低于护栏</span> : null}
              </p>
              <label className="mt-2 block">
                <span className="text-[#8c8c8c]">对外显示名</span>
                <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={selected.canonicalModelKey} />
              </label>
              <button type="button" onClick={publish} disabled={saving} className="mt-2 rounded bg-[#52c41a] px-3 py-1.5 text-sm text-white">
                发布报价
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded border border-[#e8e8e8] bg-white p-4">
          <h2 className="mb-2 text-sm font-medium">各档生成次数预览</h2>
          {comp && personalPlans.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {personalPlans.map((p) => {
                const gens = computeTierGenerations(p.monthlyCredits, comp.creditsPerUnit);
                const ppc = p.priceYuan / p.monthlyCredits;
                const eff = computeEffectiveMargin({
                  netCostYuan: comp.netCostYuan,
                  creditsPerUnit: comp.creditsPerUnit,
                  pricePerCreditYuan: ppc,
                });
                return (
                  <li key={p.tier} className="flex justify-between border-b border-[#f0f0f0] py-1">
                    <span>{p.tier}</span>
                    <span>
                      {gens} 次 · 毛利 {(eff * 100).toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[#8c8c8c]">无个人月付套餐或尚未选模型</p>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <h2 className="border-b px-3 py-2 text-sm font-medium">已发布报价（{published.length}）</h2>
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2 text-left">模型</th>
              <th className="px-3 py-2 text-left">单位</th>
              <th className="px-3 py-2 text-right">积分</th>
              <th className="px-3 py-2 text-right">挂牌价</th>
              <th className="px-3 py-2 text-right">毛利</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {published.map((p) => (
              <tr key={p.canonicalModelKey} className="border-t">
                <td className="px-3 py-2">{p.displayName}</td>
                <td className="px-3 py-2">{unitLabel(p.unit)}</td>
                <td className="px-3 py-2 text-right">{p.creditsPerUnit}</td>
                <td className="px-3 py-2 text-right">¥{p.listPriceYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right">{(p.baseMarginRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-2">{p.active ? "上架" : "下架"}</td>
                <td className="px-3 py-2 text-right">
                  {p.active ? (
                    <button type="button" className="text-red-600 hover:underline" onClick={() => unpublish(p.canonicalModelKey)}>
                      下架
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
