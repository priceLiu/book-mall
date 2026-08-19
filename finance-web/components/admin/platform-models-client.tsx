"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { ModelOpsPresentationTab } from "@/components/admin/model-ops-presentation-tab";
import { ModelOpsShelfTab } from "@/components/admin/model-ops-shelf-tab";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type OpsTab = "offerings" | "presentation" | "shelf";

type CandidateRow = {
  id: string;
  vendor: string;
  modelKey: string;
  listCostYuan: number;
  netCostYuan: number;
  unitLabel: string | null;
  creditsPerUnit: number | null;
  marginRate: number | null;
  marginOk: boolean;
  costMissing: boolean;
  isRecommended: boolean;
  isActiveRoute: boolean;
};

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
  candidates: CandidateRow[];
  recommendedVendor: string | null;
  recommendedModelKey: string | null;
  recommendedNetCostYuan: number | null;
  recommendedUnitLabel: string | null;
  activeMatchesRecommended: boolean;
  activeNetCostYuan: number | null;
  activeUnitLabel: string | null;
};

const inputCls =
  "rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "已上架",
  DEPRECATED: "已下线",
};

function formatCostYuan(amount: number | null, unitLabel: string | null): string {
  if (amount == null) return "—";
  const unit = unitLabel ? `/${unitLabel.replace(/^元\//, "")}` : "";
  return `¥${amount.toFixed(4)}${unit}`;
}

function formatMargin(c: CandidateRow): string {
  if (c.costMissing) return "缺成本";
  if (c.marginRate == null) return c.marginOk ? "OK" : "不达标";
  return `${(c.marginRate * 100).toFixed(1)}%${c.marginOk ? "" : " · 不达标"}`;
}

export function PlatformModelsClient() {
  const base = useBookMallBaseUrl();
  const [opsTab, setOpsTab] = useState<OpsTab>("offerings");
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

  if (loading && opsTab === "offerings") {
    return <FinancePageState>加载平台模型…</FinancePageState>;
  }

  return (
    <FinancePageShell className="gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">模型运营中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            商业上架、展示来源（sourceLabel）、按应用/场景分发（AppModelShelf）。
          </p>
        </div>
        {opsTab === "offerings" ? (
          <button
            type="button"
            className="rounded-md bg-[#1890ff] px-4 py-2 text-sm text-white hover:bg-[#096dd9]"
            onClick={() => void syncAll()}
          >
            同步自动上架
          </button>
        ) : null}
      </div>

      <nav className="flex gap-2 border-b border-[#f0f0f0]">
        {(
          [
            ["offerings", "商业上架"],
            ["presentation", "展示配置"],
            ["shelf", "应用分发"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm ${
              opsTab === id
                ? "border-[#1890ff] font-medium text-[#1890ff]"
                : "border-transparent text-[#8c8c8c]"
            }`}
            onClick={() => setOpsTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {opsTab === "presentation" ? <ModelOpsPresentationTab /> : null}
      {opsTab === "shelf" ? <ModelOpsShelfTab /> : null}

      {opsTab === "offerings" ? (
        <>
      <div className="rounded-lg border border-[#91d5ff] bg-[#e6f7ff] px-4 py-3 text-sm text-[#262626]">
        <p className="font-medium">同模型多厂商路由</p>
        <ol className="mt-1 list-decimal pl-5 text-[#595959]">
          <li>先在「模型成本」维护各厂商成本档（毛利须达标）。</li>
          <li>点「同步自动上架」刷新候选；系统选净成本最低者（与「推荐」标记一致）。</li>
          <li>展开候选可对比挂牌成本、净成本、积分/单位；点「设为当前」会切换路由并锁定。</li>
        </ol>
        <p className="mt-2 text-xs text-[#595959]">
          <b>DRAFT（草稿）</b>：注册表里有该模型，但尚未成功自动上架——通常因为缺少成本档、毛利护栏未过，或还没点「同步自动上架」。
          红色 DRAFT 行 id 以 <code className="text-xs">registry:</code> 开头，表示库里还没有 offering 记录。
        </p>
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
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa] text-left text-muted-foreground">
                  <th className="px-3 py-2">canonical</th>
                  <th className="px-3 py-2">展示名</th>
                  <th className="px-3 py-2">应用 tag</th>
                  <th className="px-3 py-2">当前 vendor</th>
                  <th className="px-3 py-2">modelKey</th>
                  <th className="px-3 py-2">净成本</th>
                  <th className="px-3 py-2">积分/单位</th>
                  <th className="px-3 py-2">毛利</th>
                  <th className="px-3 py-2">推荐</th>
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
                      <td className="px-3 py-2 text-xs">
                        {formatCostYuan(row.activeNetCostYuan, row.activeUnitLabel)}
                      </td>
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
                      <td className="px-3 py-2 text-xs">
                        {row.candidates.length <= 1 ? (
                          "—"
                        ) : row.activeMatchesRecommended ? (
                          <span className="text-green-700">已选推荐</span>
                        ) : row.recommendedVendor ? (
                          <span
                            className="text-amber-700"
                            title={`${row.recommendedModelKey ?? ""}`}
                          >
                            推荐: {row.recommendedVendor} ·{" "}
                            {formatCostYuan(
                              row.recommendedNetCostYuan,
                              row.recommendedUnitLabel,
                            )}
                          </span>
                        ) : (
                          <span className="text-[#8c8c8c]">无达标候选</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={row.marginWarning ? "text-red-600" : "text-green-700"}
                          title={
                            row.status === "DRAFT"
                              ? "未自动上架：补成本档或点「同步自动上架」"
                              : undefined
                          }
                        >
                          {STATUS_LABEL[row.status] ?? row.status}
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
                        <td colSpan={12} className="px-3 py-3">
                          <p className="mb-2 text-xs font-medium text-[#595959]">
                            同模型多厂商候选（推荐 = 毛利达标且净成本最低）
                          </p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[#8c8c8c]">
                                <th className="py-1">推荐</th>
                                <th className="py-1">厂商</th>
                                <th className="py-1">modelKey</th>
                                <th className="py-1 text-right">挂牌成本</th>
                                <th className="py-1 text-right">净成本</th>
                                <th className="py-1">计费单位</th>
                                <th className="py-1 text-right">积分/单位</th>
                                <th className="py-1">毛利</th>
                                <th className="py-1 text-right">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.candidates.map((c) => {
                                const creditsHint =
                                  c.creditsPerUnit != null &&
                                  row.publishedCreditsPerUnit != null &&
                                  c.creditsPerUnit !== row.publishedCreditsPerUnit
                                    ? `切换后积分/单位：${c.creditsPerUnit}（当前 ${row.publishedCreditsPerUnit}）`
                                    : c.creditsPerUnit != null
                                      ? `积分/单位：${c.creditsPerUnit}`
                                      : undefined;
                                return (
                                  <tr
                                    key={c.id}
                                    className={`border-t border-[#f0f0f0] ${c.isRecommended ? "bg-[#f6ffed]" : ""}`}
                                  >
                                    <td className="py-1.5">
                                      {c.isRecommended ? (
                                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                                          推荐
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td className="py-1.5">{c.vendor}</td>
                                    <td className="py-1.5 font-mono">{c.modelKey}</td>
                                    <td className="py-1.5 text-right">
                                      {c.costMissing ? "—" : `¥${c.listCostYuan.toFixed(4)}`}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {c.costMissing ? "—" : `¥${c.netCostYuan.toFixed(4)}`}
                                    </td>
                                    <td className="py-1.5">{c.unitLabel ?? "—"}</td>
                                    <td className="py-1.5 text-right">
                                      {c.creditsPerUnit ?? "—"}
                                    </td>
                                    <td className="py-1.5">{formatMargin(c)}</td>
                                    <td className="py-1.5 text-right">
                                      {c.isActiveRoute ? (
                                        <span className="font-medium text-[#1890ff]">当前路由</span>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={
                                            !c.marginOk ||
                                            c.costMissing ||
                                            row.id.startsWith("registry:") ||
                                            c.id.startsWith("registry:") ||
                                            busyId === `${row.id}:${c.id}`
                                          }
                                          title={creditsHint}
                                          className="text-[#1890ff] hover:underline disabled:text-[#bfbfbf] disabled:no-underline"
                                          onClick={() => void switchRoute(row, c.id)}
                                        >
                                          设为当前
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
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
        </>
      ) : null}
    </FinancePageShell>
  );
}
