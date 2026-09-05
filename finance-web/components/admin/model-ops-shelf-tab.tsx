"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type ShelfRow = {
  id: string;
  appTag: string;
  sceneKey: string;
  canonicalModelKey: string;
  status: string;
  sortOrder: number;
  catalogDisplayName: string | null;
  catalogSourceLabel: string | null;
};

const APP_TAGS = ["canvas", "ecom", "quick-replica", "story", "tool", "prompt-optimizer"];

const inputCls =
  "rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function ModelOpsShelfTab() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<ShelfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [appTag, setAppTag] = useState("canvas");
  const [sceneKey, setSceneKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const qs = new URLSearchParams({ appTag });
    if (sceneKey) qs.set("sceneKey", sceneKey);
    const r = await financeApiFetch<{ rows: ShelfRow[] }>(
      base,
      `/api/finance/admin/model-shelf?${qs}`,
    );
    if (r.ok) setRows(r.data.rows);
    setLoading(false);
  }, [base, appTag, sceneKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeCount = useMemo(
    () => rows.filter((r) => r.status === "ACTIVE").length,
    [rows],
  );

  async function toggleStatus(row: ShelfRow) {
    if (!base) return;
    const next = row.status === "ACTIVE" ? "HIDDEN" : "ACTIVE";
    const r = await financeApiPost(base, "/api/finance/admin/model-shelf", {
      rows: [
        {
          appTag: row.appTag,
          sceneKey: row.sceneKey,
          canonicalModelKey: row.canonicalModelKey,
          status: next,
          sortOrder: row.sortOrder,
        },
      ],
    });
    if (r.ok) {
      setMsg(null);
      void reload();
    } else setMsg(r.error);
  }

  if (loading) return <p className="text-sm text-[#8c8c8c]">加载中…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-[#8c8c8c]">应用</span>
          <select
            className={`${inputCls} mt-1`}
            value={appTag}
            onChange={(e) => setAppTag(e.target.value)}
          >
            {APP_TAGS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[#8c8c8c]">场景 sceneKey</span>
          <input
            className={`${inputCls} mt-1 min-w-[160px]`}
            placeholder="空=应用全局"
            value={sceneKey}
            onChange={(e) => setSceneKey(e.target.value)}
          />
        </label>
        <span className="text-xs text-[#8c8c8c]">
          共 {rows.length} 条 · 上架 {activeCount}
        </span>
        {msg ? <span className="text-sm text-[#ff4d4f]">{msg}</span> : null}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-[#fafafa] text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2">canonical</th>
              <th className="px-3 py-2">展示名</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">排序</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#f0f0f0]">
                <td className="px-3 py-2 font-mono text-xs">{r.canonicalModelKey}</td>
                <td className="px-3 py-2">{r.catalogDisplayName ?? "—"}</td>
                <td className="px-3 py-2">{r.catalogSourceLabel ?? "—"}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.sortOrder}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => void toggleStatus(r)}
                  >
                    {r.status === "ACTIVE" ? "下架" : "上架"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[#8c8c8c]">
          该应用/场景暂无分发记录。运行 seed 脚本回填，或在商业上架后手动添加。
        </p>
      ) : null}
    </div>
  );
}
