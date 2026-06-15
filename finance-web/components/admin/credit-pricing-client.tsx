"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { unitLabel, type PricingConfig } from "@/lib/credit-pricing-formulas";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";
import { ModelCreditLedgerClient } from "@/components/admin/model-credit-ledger-client";

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

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function CreditPricingClient() {
  const base = useBookMallBaseUrl();
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [published, setPublished] = useState<PublishedPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
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
      published: PublishedPrice[];
    }>(base, "/api/finance/admin/credit-pricing");
    if (r.ok) {
      setConfig(r.data.config);
      setPublished(r.data.published);
      setAnchor(r.data.config.creditAnchorYuan);
      setMarginM(r.data.config.defaultMarginM);
      setMinGuard(r.data.config.minMarginGuard);
      setVideoSec(r.data.config.defaultVideoSec);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

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

  if (loading) return <FinancePageState>加载中…</FinancePageState>;
  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;

  return (
    <FinancePageShell>
      <header>
        <h1 className="text-lg font-medium">积分报价与换算</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          全局参数 · 模型成本换算与发布 · 已上架对外报价一览
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

      <ModelCreditLedgerClient embedded />

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <h2 className="border-b px-3 py-2 text-sm font-medium">已发布报价（{published.length}）</h2>
        <p className="border-b px-3 py-1.5 text-xs text-[#8c8c8c]">
          对外已上架快照；完整成本/测算/发布请用上表 + 右侧工作台
        </p>
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2 text-left">模型</th>
              <th className="px-3 py-2 text-left">展示名</th>
              <th className="px-3 py-2 text-left">单位</th>
              <th className="px-3 py-2 text-right">积分/单位</th>
              <th className="px-3 py-2 text-right">挂牌价</th>
              <th className="px-3 py-2 text-right">系数 M</th>
              <th className="px-3 py-2 text-right">毛利</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {published.map((p) => (
              <tr key={p.canonicalModelKey} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{p.canonicalModelKey}</td>
                <td className="px-3 py-2">{p.displayName}</td>
                <td className="px-3 py-2">{unitLabel(p.unit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.creditsPerUnit}</td>
                <td className="px-3 py-2 text-right tabular-nums">¥{p.listPriceYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.marginM}</td>
                <td className="px-3 py-2 text-right tabular-nums">{(p.baseMarginRate * 100).toFixed(1)}%</td>
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
    </FinancePageShell>
  );
}
