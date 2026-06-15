"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import {
  computeEffectiveMargin,
  computeTierGenerations,
  unitLabel,
} from "@/lib/credit-pricing-formulas";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type LedgerRow = {
  canonicalModelKey: string;
  vendor: string;
  unit: string;
  tierRaw: string | null;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
  marginM: number;
  minGuard: number;
  computed: {
    listPriceYuan: number;
    creditsPerUnit: number;
    baseMarginRate: number;
    marginOk: boolean;
    videoCredits15: number | null;
    videoCredits15Anchor?: number | null;
    tierVideoCredits15?: number | null;
  };
  published: {
    displayName: string;
    creditsPerUnit: number;
    listPriceYuan: number;
    baseMarginRate: number;
    marginM: number;
    active: boolean;
    publishedAt: string;
  } | null;
};

type PlanLite = {
  family: string;
  interval: string;
  tier: string;
  priceYuan: number;
  monthlyCredits: number;
};

type PreviewResult = {
  ok: boolean;
  listPriceYuan?: number;
  creditsPerUnit?: number;
  baseMarginRate?: number;
  marginOk?: boolean;
  error?: string;
};

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function ModelCreditLedgerClient({ embedded = false }: { embedded?: boolean }) {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editMarginM, setEditMarginM] = useState(2.5);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewStale, setPreviewStale] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "published" | "unpublished">("all");

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const [ledgerR, pricingR] = await Promise.all([
      financeApiFetch<{ rows: LedgerRow[] }>(base, "/api/finance/admin/model-credit-ledger"),
      financeApiFetch<{ plans: PlanLite[] }>(base, "/api/finance/admin/credit-pricing"),
    ]);
    if (ledgerR.ok) {
      setRows(ledgerR.data.rows);
      setError(null);
      if (!selectedKey && ledgerR.data.rows[0]) {
        setSelectedKey(ledgerR.data.rows[0].canonicalModelKey);
      }
    } else {
      setError(ledgerR.error);
    }
    if (pricingR.ok) {
      setPlans(pricingR.data.plans ?? []);
    }
    setLoading(false);
  }, [base, selectedKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = rows.find((r) => r.canonicalModelKey === selectedKey);

  useEffect(() => {
    if (!selected) return;
    setDisplayName(selected.published?.displayName ?? selected.canonicalModelKey);
    setEditMarginM(selected.published?.marginM ?? selected.marginM);
    setPreview(null);
    setPreviewStale(true);
  }, [selected]);

  const filteredRows = useMemo(() => {
    if (filter === "published") return rows.filter((r) => r.published?.active);
    if (filter === "unpublished") return rows.filter((r) => !r.published?.active);
    return rows;
  }, [rows, filter]);

  const personalPlans = useMemo(
    () => plans.filter((p) => p.family === "PERSONAL" && p.interval === "MONTH"),
    [plans],
  );

  const previewComp = selected
    ? {
        netCostYuan: selected.netCostYuan,
        creditsPerUnit:
          preview && !previewStale ? (preview.creditsPerUnit ?? selected.computed.creditsPerUnit) : selected.computed.creditsPerUnit,
        listPriceYuan:
          preview && !previewStale ? (preview.listPriceYuan ?? selected.computed.listPriceYuan) : selected.computed.listPriceYuan,
        baseMarginRate:
          preview && !previewStale ? (preview.baseMarginRate ?? selected.computed.baseMarginRate) : selected.computed.baseMarginRate,
      }
    : null;

  async function runPreview() {
    if (!base || !selected) return;
    setSaving(true);
    const r = await financeApiPost<PreviewResult & { ok: boolean }>(base, "/api/finance/admin/model-credit-ledger", {
      action: "preview",
      listCostYuan: selected.listCostYuan,
      discountRate: selected.discountRate,
      unit: selected.unit,
      marginM: editMarginM,
    });
    setSaving(false);
    if (r.ok && r.data.ok) {
      setPreview(r.data);
      setPreviewStale(false);
      setMsg(null);
    } else {
      setPreview(null);
      setMsg(r.ok ? (r.data.error ?? "测算失败") : r.error);
    }
  }

  async function publish() {
    if (!base || !selected) return;
    if (previewStale || !preview?.marginOk) {
      setMsg("请先重新测算且毛利须通过护栏");
      return;
    }
    setSaving(true);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/model-credit-ledger", {
      action: "publish",
      canonicalModelKey: selected.canonicalModelKey,
      displayName: displayName || selected.canonicalModelKey,
      marginM: editMarginM,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "发布失败") : r.error);
    else {
      setMsg("已发布上架");
      reload();
    }
  }

  async function unpublish(key: string) {
    if (!base) return;
    setSaving(true);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/model-credit-ledger", {
      action: "unpublish",
      canonicalModelKey: key,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "下架失败") : r.error);
    else reload();
  }

  if (loading) return <FinancePageState>加载中…</FinancePageState>;
  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;

  const body = (
    <>
      {!embedded ? (
        <header>
          <h1 className="text-lg font-medium">积分换算工作台</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            左栏系统测算 · 右栏可改系数 M · 修改后须重新测算 · 通过护栏方可发布上架
          </p>
        </header>
      ) : (
        <section>
          <h2 className="text-sm font-medium">模型换算工作台</h2>
          <p className="mt-1 text-xs text-[#8c8c8c]">
            含净成本 C、挂牌价 P、系数 M、毛利护栏；15s 用户实扣与画布 Dock 一致
          </p>
        </section>
      )}
      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}

      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", "published", "unpublished"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded px-2 py-1 ${filter === f ? "bg-[#1890ff] text-white" : "border border-[#d9d9d9]"}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "全部" : f === "published" ? "已上架" : "未上架"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
              <tr>
                <th className="px-3 py-2">模型</th>
                <th className="px-3 py-2">展示名</th>
                <th className="px-3 py-2">厂商</th>
                <th className="px-3 py-2">单位</th>
                <th className="px-3 py-2 text-right">净成本 C</th>
                <th className="px-3 py-2 text-right">挂牌价 P</th>
                <th className="px-3 py-2 text-right">系数 M</th>
                <th className="px-3 py-2 text-right">积分/单位</th>
                <th className="px-3 py-2 text-right">毛利</th>
                <th className="px-3 py-2 text-right">15s 锚定</th>
                <th className="px-3 py-2 text-right">15s 用户实扣</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.canonicalModelKey}
                  className={`cursor-pointer border-t ${selectedKey === r.canonicalModelKey ? "bg-[#e6f7ff]" : "hover:bg-[#fafafa]"}`}
                  onClick={() => setSelectedKey(r.canonicalModelKey)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{r.canonicalModelKey}</td>
                  <td className="max-w-[120px] truncate px-3 py-2" title={r.published?.displayName}>
                    {r.published?.displayName ?? "—"}
                  </td>
                  <td className="px-3 py-2">{r.vendor}</td>
                  <td className="px-3 py-2">{unitLabel(r.unit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">¥{r.netCostYuan.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">¥{r.computed.listPriceYuan.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.published?.marginM ?? r.marginM}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.computed.creditsPerUnit}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${r.computed.marginOk ? "text-green-600" : "text-red-500"}`}
                  >
                    {(r.computed.baseMarginRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#8c8c8c]">
                    {r.computed.videoCredits15Anchor ?? r.computed.videoCredits15 ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-[#1890ff]">
                    {r.computed.tierVideoCredits15 ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.published?.active ? (
                      <span className="text-green-600">已上架</span>
                    ) : r.computed.marginOk ? (
                      <span className="text-[#faad14]">可发布</span>
                    ) : (
                      <span className="text-red-500">护栏未过</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {selected ? (
          <aside className="space-y-4 rounded border border-[#e8e8e8] bg-white p-4">
            <h2 className="text-sm font-medium">{selected.canonicalModelKey}</h2>

            <div className="rounded bg-[#fafafa] p-3 text-sm">
              <p className="mb-2 font-medium text-[#595959]">系统测算（只读）</p>
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                <dt className="text-[#8c8c8c]">净成本 C</dt>
                <dd className="tabular-nums">¥{selected.netCostYuan.toFixed(4)}</dd>
                <dt className="text-[#8c8c8c]">挂牌价 P</dt>
                <dd className="tabular-nums">¥{selected.computed.listPriceYuan.toFixed(4)}</dd>
                <dt className="text-[#8c8c8c]">积分/单位 U</dt>
                <dd className="tabular-nums">{selected.computed.creditsPerUnit}</dd>
                <dt className="text-[#8c8c8c]">理论毛利</dt>
                <dd className={selected.computed.marginOk ? "text-green-600" : "text-red-500"}>
                  {(selected.computed.baseMarginRate * 100).toFixed(1)}%
                </dd>
              </dl>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium text-[#595959]">运营调整</p>
              <label>
                <span className="text-xs text-[#8c8c8c]">展示名</span>
                <input className={inputCls} value={displayName} onChange={(e) => { setDisplayName(e.target.value); setPreviewStale(true); }} />
              </label>
              <label>
                <span className="text-xs text-[#8c8c8c]">系数 M</span>
                <input
                  type="number"
                  step="0.1"
                  className={inputCls}
                  value={editMarginM}
                  onChange={(e) => { setEditMarginM(Number(e.target.value)); setPreviewStale(true); }}
                />
              </label>
              <button
                type="button"
                className="w-full rounded border border-[#1890ff] py-1.5 text-[#1890ff]"
                disabled={saving}
                onClick={runPreview}
              >
                重新测算
              </button>
              {preview && !previewStale ? (
                <div className="rounded border border-[#d9d9d9] p-2 text-xs">
                  <p>调整后挂牌 ¥{preview.listPriceYuan?.toFixed(4)}</p>
                  <p>积分/单位 {preview.creditsPerUnit}</p>
                  <p className={preview.marginOk ? "text-green-600" : "text-red-500"}>
                    毛利 {((preview.baseMarginRate ?? 0) * 100).toFixed(1)}%
                    {preview.marginOk ? " ✓" : " ✗ 未过护栏"}
                  </p>
                </div>
              ) : previewStale ? (
                <p className="text-xs text-[#faad14]">参数已改，请重新测算后再发布</p>
              ) : null}
            </div>

            {previewComp && personalPlans.length > 0 ? (
              <div className="rounded border border-[#e8e8e8] p-3 text-sm">
                <p className="mb-2 font-medium text-[#595959]">各档生成次数预览</p>
                <ul className="space-y-1 text-xs">
                  {personalPlans.map((p) => {
                    const gens = computeTierGenerations(p.monthlyCredits, previewComp.creditsPerUnit);
                    const ppc = p.priceYuan / p.monthlyCredits;
                    const eff = computeEffectiveMargin({
                      netCostYuan: previewComp.netCostYuan,
                      creditsPerUnit: previewComp.creditsPerUnit,
                      pricePerCreditYuan: ppc,
                    });
                    return (
                      <li key={p.tier} className="flex justify-between border-b border-[#f0f0f0] py-1">
                        <span>{p.tier}</span>
                        <span className="tabular-nums">
                          {gens} 次 · 毛利 {(eff * 100).toFixed(1)}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded bg-[#1890ff] py-2 text-sm text-white disabled:opacity-50"
                disabled={saving || previewStale || !preview?.marginOk}
                onClick={publish}
              >
                发布上架
              </button>
              {selected.published?.active ? (
                <button
                  type="button"
                  className="rounded border border-red-400 px-3 py-2 text-sm text-red-500"
                  disabled={saving}
                  onClick={() => unpublish(selected.canonicalModelKey)}
                >
                  下架
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );

  if (embedded) return body;

  return <FinancePageShell>{body}</FinancePageShell>;
}
