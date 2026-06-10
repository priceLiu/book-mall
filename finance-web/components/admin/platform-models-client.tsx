"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type OfferingRow = {
  id: string;
  canonicalModelKey: string;
  mediaKind: string | null;
  mediaKindLabel: string | null;
  role: string;
  displayName: string;
  status: string;
  routeLocked: boolean;
  activeVendor: string | null;
  activeModelKey: string | null;
  publishedCreditsPerUnit: number | null;
  estimatedMargin: number | null;
  marginWarning: boolean;
  appTags: string[];
  candidates: Array<{
    id: string;
    vendor: string;
    modelKey: string;
    netCostYuan: number;
    marginOk: boolean;
    isActiveRoute: boolean;
  }>;
};

const inputCls =
  "rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

export function PlatformModelsClient() {
  const base = useBookMallBaseUrl();
  const [rows, setRows] = useState<OfferingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterMedia, setFilterMedia] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filterAppTag, setFilterAppTag] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setError(null);
    const r = await financeApiFetch<{ offerings: OfferingRow[] }>(
      base,
      "/api/finance/admin/platform-models",
    );
    if (r.ok) setRows(r.data.offerings);
    else setError(r.error);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mediaOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.mediaKindLabel).filter(Boolean))).sort() as string[],
    [rows],
  );

  const appTagOptions = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.appTags))).sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const media = filterMedia.trim();
    const text = filterText.trim().toLowerCase();
    const tag = filterAppTag.trim().toLowerCase();
    return rows.filter((r) => {
      if (media && r.mediaKindLabel !== media) return false;
      if (tag && !r.appTags.some((t) => t.toLowerCase() === tag)) return false;
      if (
        text &&
        !r.canonicalModelKey.toLowerCase().includes(text) &&
        !r.displayName.toLowerCase().includes(text)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, filterMedia, filterText, filterAppTag]);

  const mediaGroups = useMemo(() => {
    const map = new Map<string, OfferingRow[]>();
    for (const row of filteredRows) {
      const groupKey = row.mediaKindLabel ?? row.role;
      const list = map.get(groupKey) ?? [];
      list.push(row);
      map.set(groupKey, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "zh"));
  }, [filteredRows]);

  async function syncAll() {
    if (!base) return;
    setMsg(null);
    setError(null);
    const r = await financeApiPost<{
      published: number;
      skipped: number;
      warnings: string[];
    }>(base, "/api/finance/admin/platform-models/auto-publish", {});
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setMsg(`已同步：${r.data.published} 个 ACTIVE，${r.data.skipped} 个跳过`);
    if (r.data.warnings.length) setError(r.data.warnings.slice(0, 3).join("；"));
    await reload();
  }

  async function toggleLock(row: OfferingRow) {
    if (!base || row.id.startsWith("registry:")) return;
    setBusyId(row.id);
    setError(null);
    const r = await financeApiFetch(base, "/api/finance/admin/platform-models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offeringId: row.id, routeLocked: !row.routeLocked }),
    });
    if (!r.ok) setError(r.error);
    else await reload();
    setBusyId(null);
  }

  async function switchRoute(row: OfferingRow, candidateId: string) {
    if (!base || row.id.startsWith("registry:") || candidateId.startsWith("registry:")) return;
    setBusyId(`${row.id}:${candidateId}`);
    setError(null);
    const r = await financeApiFetch(base, "/api/finance/admin/platform-models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offeringId: row.id, candidateId }),
    });
    if (!r.ok) setError(r.error);
    else {
      setMsg(`已切换 ${row.displayName} 路由并锁定`);
      await reload();
    }
    setBusyId(null);
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">加载平台模型…</p>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Gateway 模型上架</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            每个逻辑模型（canonical）一行；候选 = 同模型多厂商路由。毛利达标时默认最低净成本；换厂商请展开 →「设为当前」。
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-[#1890ff] px-4 py-2 text-sm text-white hover:bg-[#096dd9]"
          onClick={() => void syncAll()}
        >
          同步自动上架
        </button>
      </div>

      <div className="rounded-lg border border-[#91d5ff] bg-[#e6f7ff] px-4 py-3 text-sm text-[#262626]">
        <p className="font-medium">同模型多厂商路由</p>
        <ol className="mt-1 list-decimal pl-5 text-[#595959]">
          <li>先在「模型成本」维护各厂商成本档（毛利须达标）。</li>
          <li>点「同步自动上架」刷新候选；系统选净成本最低者。</li>
          <li>候选行点 <b>设为当前</b> 会切换路由并锁定；解锁后可恢复自动选型。</li>
        </ol>
      </div>

      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="flex flex-wrap items-end gap-3 rounded border bg-white p-3">
        <label className="text-sm">
          <span className="text-[#8c8c8c]">媒介类型</span>
          <select
            className={`${inputCls} mt-1 min-w-[140px]`}
            value={filterMedia}
            onChange={(e) => setFilterMedia(e.target.value)}
          >
            <option value="">全部</option>
            {mediaOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[#8c8c8c]">应用 tag</span>
          <select
            className={`${inputCls} mt-1 min-w-[120px]`}
            value={filterAppTag}
            onChange={(e) => setFilterAppTag(e.target.value)}
          >
            <option value="">全部</option>
            {appTagOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="text-[#8c8c8c]">模型 / 展示名</span>
          <input
            className={`${inputCls} mt-1 w-full`}
            placeholder="canonical 或展示名"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded border border-[#d9d9d9] px-3 py-1.5 text-sm"
          onClick={() => {
            setFilterMedia("");
            setFilterAppTag("");
            setFilterText("");
          }}
        >
          重置
        </button>
        <span className="text-xs text-[#8c8c8c]">共 {filteredRows.length} 个模型</span>
      </section>

      {mediaGroups.map(([groupLabel, list]) => (
        <section key={groupLabel} className="rounded-lg border bg-white">
          <header className="border-b px-4 py-3 font-medium">{groupLabel}</header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa] text-left text-muted-foreground">
                  <th className="px-3 py-2">canonical</th>
                  <th className="px-3 py-2">展示名</th>
                  <th className="px-3 py-2">应用 tag</th>
                  <th className="px-3 py-2">当前 vendor</th>
                  <th className="px-3 py-2">modelKey</th>
                  <th className="px-3 py-2">积分/单位</th>
                  <th className="px-3 py-2">毛利</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">锁定</th>
                  <th className="px-3 py-2">候选</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-border/60 align-top">
                      <td className="px-3 py-2 font-mono text-xs">{row.canonicalModelKey}</td>
                      <td className="px-3 py-2">{row.displayName}</td>
                      <td className="px-3 py-2 text-xs">{row.appTags.join(", ") || "—"}</td>
                      <td className="px-3 py-2">{row.activeVendor ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.activeModelKey ?? "—"}</td>
                      <td className="px-3 py-2">{row.publishedCreditsPerUnit ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.estimatedMargin != null ? (
                          <span className={row.marginWarning ? "font-medium text-red-600" : ""}>
                            {(row.estimatedMargin * 100).toFixed(1)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={row.marginWarning ? "text-red-600" : "text-green-700"}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={busyId === row.id || row.id.startsWith("registry:")}
                          className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                          onClick={() => void toggleLock(row)}
                        >
                          {row.routeLocked ? "已锁定" : "未锁定"}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {row.candidates.length > 0 ? (
                          <button
                            type="button"
                            className="text-[#1890ff] hover:underline"
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                          >
                            {expandedId === row.id ? "收起" : `${row.candidates.length} 个厂商`}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    {expandedId === row.id && row.candidates.length > 0 ? (
                      <tr className="bg-[#fafafa]">
                        <td colSpan={10} className="px-3 py-3">
                          <p className="mb-2 text-xs font-medium text-[#595959]">
                            同模型多厂商候选（点「设为当前」切换路由）
                          </p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[#8c8c8c]">
                                <th className="py-1">厂商</th>
                                <th className="py-1">modelKey</th>
                                <th className="py-1 text-right">净成本</th>
                                <th className="py-1">毛利</th>
                                <th className="py-1 text-right">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.candidates.map((c) => (
                                <tr key={c.id} className="border-t border-[#f0f0f0]">
                                  <td className="py-1.5">{c.vendor}</td>
                                  <td className="py-1.5 font-mono">{c.modelKey}</td>
                                  <td className="py-1.5 text-right">¥{c.netCostYuan.toFixed(4)}</td>
                                  <td className="py-1.5">{c.marginOk ? "OK" : "不达标"}</td>
                                  <td className="py-1.5 text-right">
                                    {c.isActiveRoute ? (
                                      <span className="font-medium text-[#1890ff]">当前路由</span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={
                                          !c.marginOk ||
                                          row.id.startsWith("registry:") ||
                                          c.id.startsWith("registry:") ||
                                          busyId === `${row.id}:${c.id}`
                                        }
                                        className="text-[#1890ff] hover:underline disabled:text-[#bfbfbf] disabled:no-underline"
                                        onClick={() => void switchRoute(row, c.id)}
                                      >
                                        设为当前
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
