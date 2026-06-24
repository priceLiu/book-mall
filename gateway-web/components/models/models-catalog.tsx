"use client";

import { useMemo, useState } from "react";

import {
  formatProviderKindLabel,
  formatRequestKindLabel,
} from "@/lib/gateway-model-display";

export type CatalogModel = {
  modelKey: string;
  displayName: string;
  requestKind: string;
  role: string;
  description: string | null;
  products: string[];
};

export type CatalogGroup = {
  providerKind: string;
  label: string;
  credentialBound: boolean;
  models: CatalogModel[];
};

export function ModelsCatalog({
  groups,
  totalCount,
  boundKinds,
}: {
  groups: CatalogGroup[];
  totalCount: number;
  boundKinds: string[];
}) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [onlyBound, setOnlyBound] = useState(false);

  const requestKinds = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      for (const m of g.models) set.add(m.requestKind);
    }
    return [...set].sort();
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => !onlyBound || g.credentialBound)
      .map((g) => ({
        ...g,
        models: g.models.filter((m) => {
          if (kindFilter !== "all" && m.requestKind !== kindFilter) return false;
          if (!q) return true;
          const hay = [
            m.modelKey,
            m.displayName,
            m.description ?? "",
            m.products.join(" "),
            g.label,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        }),
      }))
      .filter((g) => g.models.length > 0);
  }, [groups, query, kindFilter, onlyBound]);

  const visibleCount = filteredGroups.reduce((n, g) => n + g.models.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-xs text-[var(--gw-muted)]">搜索 modelKey / 名称</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如 seedance、wan2.7、deepseek"
            className="gw-input w-full"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-[var(--gw-muted)]">能力类型</span>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="gw-input"
          >
            <option value="all">全部</option>
            {requestKinds.map((k) => (
              <option key={k} value={k}>
                {formatRequestKindLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-[var(--gw-muted)]">
          <input
            type="checkbox"
            checked={onlyBound}
            onChange={(e) => setOnlyBound(e.target.checked)}
            className="rounded border-white/20"
          />
          仅已绑定凭证的厂商
        </label>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-[var(--gw-muted)]">
        <span>
          共 <strong className="text-[var(--gw-ink)]">{totalCount}</strong> 个模型
        </span>
        <span>·</span>
        <span>
          当前筛选 <strong className="text-[var(--gw-ink)]">{visibleCount}</strong> 个
        </span>
        {boundKinds.length > 0 ? (
          <>
            <span>·</span>
            <span>
              已绑定凭证：{" "}
              {boundKinds.map((k) => formatProviderKindLabel(k)).join(" / ")}
            </span>
          </>
        ) : (
          <>
            <span>·</span>
            <span className="text-amber-300/90">尚未绑定任何厂商凭证</span>
          </>
        )}
      </div>

      <div className="space-y-6">
        {filteredGroups.map((group) => (
          <section key={group.providerKind} className="gw-card overflow-hidden">
            <header className="flex flex-wrap items-center gap-2 border-b border-[var(--gw-border)] px-4 py-3">
              <h2>{group.label}</h2>
              <span className="rounded-full border border-[var(--gw-border)] px-2 py-0.5 text-[11px] text-[var(--gw-muted)]">
                {group.providerKind}
              </span>
              {group.credentialBound ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                  凭证已绑定
                </span>
              ) : (
                <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-[11px] text-[var(--gw-muted)]">
                  未绑定凭证
                </span>
              )}
              <span className="ml-auto text-xs text-[var(--gw-muted)]">
                {group.models.length} 个模型
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="gw-th-row border-b border-[var(--gw-border)]">
                    <th className="px-4 py-2 font-medium">modelKey</th>
                    <th className="px-4 py-2 font-medium">名称</th>
                    <th className="px-4 py-2 font-medium">类型</th>
                    <th className="px-4 py-2 font-medium">接入产品</th>
                    <th className="px-4 py-2 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {group.models.map((m) => (
                    <tr
                      key={`${group.providerKind}:${m.modelKey}`}
                      className="border-b border-[var(--gw-border)] last:border-0 hover:bg-[var(--gw-hover)]"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--gw-ink)]">
                        {m.modelKey}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--gw-ink)]">{m.displayName}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-[var(--gw-ink)]">
                          {formatRequestKindLabel(m.requestKind)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--gw-muted)]">
                        {m.products.join(" · ")}
                      </td>
                      <td className="max-w-xs px-4 py-2.5 text-xs leading-relaxed text-[var(--gw-muted)]">
                        {m.description ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {filteredGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--gw-border)] px-6 py-10 text-center text-sm text-[var(--gw-muted)]">
            没有匹配的模型。试试清空搜索或关闭「仅已绑定凭证的厂商」。
          </div>
        ) : null}
      </div>
    </div>
  );
}
