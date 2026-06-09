"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

const CHANNELS = ["CHANNEL", "OWN", "RESELLER"] as const;
const UNITS = ["PER_SEC", "PER_IMAGE", "PER_KTOKEN"] as const;
const UNIT_LABEL: Record<string, string> = {
  PER_SEC: "元/秒",
  PER_IMAGE: "元/张",
  PER_KTOKEN: "元/千token",
};
const CHANNEL_LABEL: Record<string, string> = {
  CHANNEL: "渠道折扣",
  OWN: "厂商自有",
  RESELLER: "代理转售",
};

type CostRow = {
  id: string;
  vendor: string;
  canonicalModelKey: string;
  channel: string;
  credentialId: string | null;
  unit: string;
  tierRaw: string | null;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
  note: string | null;
  active: boolean;
};

const EMPTY = {
  vendor: "",
  canonicalModelKey: "",
  channel: "CHANNEL",
  credentialId: "",
  unit: "PER_IMAGE",
  tierRaw: "",
  listCostYuan: 0,
  discountRate: 0,
  note: "",
  active: true,
};

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function ModelCostClient() {
  const base = useBookMallBaseUrl();
  const [profiles, setProfiles] = useState<CostRow[]>([]);
  const [catalogKeys, setCatalogKeys] = useState<{ key: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setError(null);
    const r = await financeApiFetch<{ profiles: CostRow[]; catalogKeys: { key: string; name: string }[] }>(
      base,
      "/api/finance/admin/model-cost",
    );
    if (r.ok) {
      setProfiles(r.data.profiles);
      setCatalogKeys(r.data.catalogKeys);
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  const netPreview = useMemo(
    () => draft.listCostYuan * (1 - Math.min(Math.max(draft.discountRate, 0), 1)),
    [draft.listCostYuan, draft.discountRate],
  );

  function startEdit(row: CostRow) {
    setEditingId(row.id);
    setDraft({
      vendor: row.vendor,
      canonicalModelKey: row.canonicalModelKey,
      channel: row.channel,
      credentialId: row.credentialId ?? "",
      unit: row.unit,
      tierRaw: row.tierRaw ?? "",
      listCostYuan: row.listCostYuan,
      discountRate: row.discountRate,
      note: row.note ?? "",
      active: row.active,
    });
    setMsg(null);
  }

  function startNew() {
    setEditingId(null);
    setDraft(EMPTY);
    setMsg(null);
  }

  async function submit() {
    if (!base) return;
    setSaving(true);
    setMsg(null);
    const body: Record<string, unknown> = {
      action: "upsert",
      vendor: draft.vendor,
      canonicalModelKey: draft.canonicalModelKey,
      channel: draft.channel,
      unit: draft.unit,
      listCostYuan: draft.listCostYuan,
      discountRate: draft.discountRate,
      active: draft.active,
    };
    if (editingId) body.id = editingId;
    if (draft.tierRaw) body.tierRaw = draft.tierRaw;
    if (draft.credentialId) body.credentialId = draft.credentialId;
    if (draft.note) body.note = draft.note;
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/model-cost", body);
    setSaving(false);
    if (!r.ok || !r.data.ok) {
      setMsg(r.ok ? (r.data.error ?? "保存失败") : r.error);
      return;
    }
    setMsg("已保存");
    startNew();
    reload();
  }

  async function confirmDelete() {
    if (!base || !deleteId) return;
    setSaving(true);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/model-cost", {
      action: "delete",
      id: deleteId,
    });
    setSaving(false);
    setDeleteId(null);
    if (!r.ok || !r.data.ok) {
      setMsg(r.ok ? (r.data.error ?? "删除失败") : r.error);
      return;
    }
    reload();
  }

  if (loading) return <p className="p-6 text-sm text-[#8c8c8c]">加载中…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="text-lg font-medium text-[#262626]">模型成本与渠道折扣</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          仅财务管理员可见。维护各模型在不同渠道下的挂牌成本与折扣，供积分报价计算器引用。
        </p>
      </header>

      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">{editingId ? "编辑成本档" : "新增成本档"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <label className="text-sm">
            <span className="text-[#8c8c8c]">厂商</span>
            <input className={inputCls} value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">模型键</span>
            <input
              className={inputCls}
              list="catalog-keys"
              value={draft.canonicalModelKey}
              onChange={(e) => setDraft({ ...draft, canonicalModelKey: e.target.value })}
            />
            <datalist id="catalog-keys">
              {catalogKeys.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">渠道</span>
            <select className={inputCls} value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">单位</span>
            <select className={inputCls} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">规格（可选）</span>
            <input className={inputCls} value={draft.tierRaw} onChange={(e) => setDraft({ ...draft, tierRaw: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">挂牌成本（元）</span>
            <input
              type="number"
              step="0.0001"
              className={inputCls}
              value={draft.listCostYuan}
              onChange={(e) => setDraft({ ...draft, listCostYuan: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">折扣率 0~1</span>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={draft.discountRate}
              onChange={(e) => setDraft({ ...draft, discountRate: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[#8c8c8c]">凭证 ID（可选）</span>
            <input className={inputCls} value={draft.credentialId} onChange={(e) => setDraft({ ...draft, credentialId: e.target.value })} />
          </label>
        </div>
        <label className="mt-2 block text-sm">
          <span className="text-[#8c8c8c]">备注</span>
          <input className={inputCls} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            生效中
          </label>
          <span className="text-[#8c8c8c]">
            净成本预览：<b>¥{netPreview.toFixed(4)}</b>
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded bg-[#1890ff] px-3 py-1.5 text-white hover:bg-[#40a9ff] disabled:opacity-50"
          >
            {editingId ? "保存" : "新增"}
          </button>
          {editingId ? (
            <button type="button" onClick={startNew} className="rounded border border-[#d9d9d9] px-3 py-1.5">
              取消
            </button>
          ) : null}
        </div>
      </section>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2">模型</th>
              <th className="px-3 py-2">厂商/渠道</th>
              <th className="px-3 py-2">单位</th>
              <th className="px-3 py-2 text-right">挂牌</th>
              <th className="px-3 py-2 text-right">折扣</th>
              <th className="px-3 py-2 text-right">净成本</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t hover:bg-[#fafafa]">
                <td className="px-3 py-2 font-medium">
                  {p.canonicalModelKey}
                  {p.tierRaw ? <span className="ml-1 text-xs text-[#8c8c8c]">{p.tierRaw}</span> : null}
                </td>
                <td className="px-3 py-2">
                  {p.vendor}{" "}
                  <span className="rounded bg-[#f0f0f0] px-1 text-xs">{CHANNEL_LABEL[p.channel] ?? p.channel}</span>
                </td>
                <td className="px-3 py-2">{UNIT_LABEL[p.unit] ?? p.unit}</td>
                <td className="px-3 py-2 text-right">¥{p.listCostYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right">{(p.discountRate * 100).toFixed(0)}%</td>
                <td className="px-3 py-2 text-right font-medium">¥{p.netCostYuan.toFixed(4)}</td>
                <td className="px-3 py-2">{p.active ? "生效" : "停用"}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-[#1890ff] hover:underline" onClick={() => startEdit(p)}>
                    编辑
                  </button>
                  <button type="button" className="ml-2 text-red-600 hover:underline" onClick={() => setDeleteId(p.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[#8c8c8c]">
                  暂无成本档
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="max-w-sm rounded bg-white p-4 shadow">
            <p className="text-sm">确认删除该成本档？此操作不可恢复。</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setDeleteId(null)}>
                取消
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
                onClick={confirmDelete}
                disabled={saving}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
