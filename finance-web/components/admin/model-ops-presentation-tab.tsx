"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type CatalogRow = {
  canonicalModelKey: string;
  displayName: string;
  sourceLabel: string | null;
  appTags: string[];
  role: string | null;
};

const inputCls =
  "rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function ModelOpsPresentationTab() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const r = await financeApiFetch<{ catalogs: CatalogRow[] }>(
      base,
      "/api/finance/admin/model-presentation",
    );
    if (r.ok) setRows(r.data.catalogs);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      r.canonicalModelKey.toLowerCase().includes(q) ||
      r.displayName.toLowerCase().includes(q) ||
      (r.sourceLabel ?? "").toLowerCase().includes(q)
    );
  });

  async function saveRow(key: string, sourceLabel: string) {
    if (!base) return;
    setMsg(null);
    const r = await financeApiPost(base, "/api/finance/admin/model-presentation", {
      updates: [{ canonicalModelKey: key, sourceLabel: sourceLabel.trim() || null }],
    });
    if (r.ok) {
      setMsg("已保存");
      void reload();
    } else setMsg(r.error);
  }

  async function batchKie() {
    if (!base) return;
    setMsg(null);
    const r = await financeApiPost(base, "/api/finance/admin/model-presentation", {
      batchKieToThirdParty: true,
    });
    if (r.ok) {
      setMsg(`已批量设置 KIE → 第三方（${r.data.count ?? 0} 条）`);
      void reload();
    } else setMsg(r.error);
  }

  if (loading) return <p className="text-sm text-[#8c8c8c]">加载中…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <input
          className={`${inputCls} min-w-[200px]`}
          placeholder="搜索 canonical / 展示名 / 来源"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void batchKie()}>
          KIE 全部设为「第三方」
        </button>
        {msg ? <span className="text-sm text-[#52c41a]">{msg}</span> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-[#fafafa] text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2">canonical</th>
              <th className="px-3 py-2">展示名</th>
              <th className="px-3 py-2">来源 sourceLabel</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <PresentationRow key={r.canonicalModelKey} row={r} onSave={saveRow} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PresentationRow({
  row,
  onSave,
}: {
  row: CatalogRow;
  onSave: (key: string, label: string) => void;
}) {
  const [draft, setDraft] = useState(row.sourceLabel ?? "");
  useEffect(() => {
    setDraft(row.sourceLabel ?? "");
  }, [row.sourceLabel]);
  return (
    <tr className="border-b border-[#f0f0f0]">
      <td className="px-3 py-2 font-mono text-xs">{row.canonicalModelKey}</td>
      <td className="px-3 py-2">{row.displayName}</td>
      <td className="px-3 py-2">
        <input
          className={inputCls}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="第三方 / 平台 / Grok…"
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => void onSave(row.canonicalModelKey, draft)}
        >
          保存
        </button>
      </td>
    </tr>
  );
}
