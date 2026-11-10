"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PLATFORM_ERROR_APP_FILTER_OPTIONS } from "@/lib/admin/platform-error-app-filter";
import {
  PLATFORM_ERROR_CATEGORY_FILTER_OPTIONS,
  type PlatformErrorCategoryKey,
} from "@/lib/admin/platform-error-category-filter";

const PAGE_SIZE = 30;

type PlatformErrorRow = {
  id: string;
  createdAt: string;
  source: string;
  severity: string;
  code: string | null;
  message: string;
  detail: string | null;
  context: Record<string, unknown> | null;
  occurrenceCount: number;
  resolvedAt: string | null;
  resolvedNote: string | null;
};

type ListResponse = {
  items?: PlatformErrorRow[];
  nextCursor?: string | null;
  error?: string;
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function contextSummary(ctx: Record<string, unknown> | null): string {
  if (!ctx) return "—";
  const parts: string[] = [];
  if (typeof ctx.clientPage === "string") parts.push(ctx.clientPage);
  if (typeof ctx.projectId === "string") parts.push(`project ${ctx.projectId.slice(0, 8)}…`);
  if (typeof ctx.nodeId === "string") parts.push(`node ${ctx.nodeId.slice(0, 8)}…`);
  if (typeof ctx.modelKey === "string") parts.push(ctx.modelKey);
  if (typeof ctx.gatewayLogId === "string") parts.push(`gw ${ctx.gatewayLogId.slice(0, 8)}…`);
  return parts.length ? parts.join(" · ") : "—";
}

function FilterPill({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-secondary hover:bg-muted/50"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function PlatformErrorsAdminClient() {
  const [items, setItems] = useState<PlatformErrorRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<PlatformErrorCategoryKey>("");
  const [appFilter, setAppFilter] = useState("");
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const busy = loading || refreshing || loadingMore;

  const buildQuery = useCallback(
    (cursor?: string) => {
      const q = new URLSearchParams();
      if (categoryFilter) q.set("category", categoryFilter);
      if (appFilter) q.set("appKey", appFilter);
      if (unresolvedOnly) q.set("unresolved", "1");
      q.set("take", String(PAGE_SIZE));
      if (cursor) q.set("cursor", cursor);
      return q;
    },
    [appFilter, categoryFilter, unresolvedOnly],
  );

  const fetchPage = useCallback(
    async (cursor?: string): Promise<ListResponse> => {
      const r = await fetch(`/api/admin/platform-errors?${buildQuery(cursor).toString()}`);
      const j = (await r.json()) as ListResponse;
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      return j;
    },
    [buildQuery],
  );

  const loadFirstPage = useCallback(
    async (mode: "full" | "soft" = "full") => {
      if (mode === "full") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const j = await fetchPage();
        setItems(j.items ?? []);
        setNextCursor(j.nextCursor ?? null);
        setExpandedId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const j = await fetchPage(nextCursor);
      const batch = j.items ?? [];
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const row of batch) {
          if (!seen.has(row.id)) merged.push(row);
        }
        return merged;
      });
      setNextCursor(j.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, nextCursor]);

  useEffect(() => {
    void loadFirstPage("full");
  }, [loadFirstPage]);

  const toggleResolved = async (row: PlatformErrorRow) => {
    const resolved = !row.resolvedAt;
    try {
      const r = await fetch("/api/admin/platform-errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, resolved }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const patch = (await r.json()) as { item?: PlatformErrorRow };
      const updated = patch.item;
      if (updated) {
        setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, ...updated } : it)));
        if (unresolvedOnly && resolved) {
          setItems((prev) => prev.filter((it) => it.id !== row.id));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const appFiltersDisabled = categoryFilter === "system" || categoryFilter === "credits";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm text-muted-foreground">类别</span>
        {PLATFORM_ERROR_CATEGORY_FILTER_OPTIONS.map((opt) => (
          <FilterPill
            key={opt.value || "category-all"}
            active={categoryFilter === opt.value}
            disabled={busy}
            label={opt.label}
            onClick={() => {
              setCategoryFilter(opt.value);
              if (opt.value === "system" || opt.value === "credits") {
                setAppFilter("");
              }
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm text-muted-foreground">应用</span>
        {appFiltersDisabled ? (
          <span className="text-sm text-muted-foreground">当前类别下不按应用拆分</span>
        ) : (
          PLATFORM_ERROR_APP_FILTER_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.value || "app-all"}
              active={appFilter === opt.value}
              disabled={busy}
              label={opt.label}
              onClick={() => setAppFilter(opt.value)}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
          />
          仅未处理
        </label>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-secondary px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50"
          onClick={() => void loadFirstPage("soft")}
        >
          刷新
        </button>
        {!loading && items.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            已加载 {items.length} 条
            {nextCursor ? "（还有更多）" : ""}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">时间</th>
              <th className="p-3 font-medium">来源</th>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">摘要</th>
              <th className="p-3 font-medium">上下文</th>
              <th className="p-3 font-medium">次数</th>
              <th className="p-3 font-medium">状态</th>
              <th className="p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted-foreground">
                  <span className="inline-flex items-center justify-center gap-2 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    正在加载错误日志…
                  </span>
                </td>
              </tr>
            ) : null}
            {!loading
              ? items.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-secondary/60 hover:bg-muted/30">
                      <td className="whitespace-nowrap p-3 text-muted-foreground">
                        {formatTime(row.createdAt)}
                      </td>
                      <td className="p-3">{row.source}</td>
                      <td className="p-3 font-mono text-xs">{row.code ?? "—"}</td>
                      <td className="max-w-md p-3">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() =>
                            setExpandedId((id) => (id === row.id ? null : row.id))
                          }
                        >
                          {row.message.length > 120
                            ? `${row.message.slice(0, 117)}…`
                            : row.message}
                        </button>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {contextSummary(row.context)}
                      </td>
                      <td className="p-3 tabular-nums">{row.occurrenceCount}</td>
                      <td className="p-3">
                        {row.resolvedAt ? (
                          <span className="text-emerald-600">已处理</span>
                        ) : (
                          <span className="text-amber-600">待处理</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded border border-secondary px-2 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
                          onClick={() => void toggleResolved(row)}
                        >
                          {row.resolvedAt ? "重新打开" : "标记已处理"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === row.id ? (
                      <tr key={`${row.id}-detail`} className="bg-muted/20">
                        <td colSpan={8} className="p-4 text-xs">
                          {row.detail ? (
                            <pre className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-3">
                              {row.detail}
                            </pre>
                          ) : null}
                          {row.context ? (
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-3">
                              {JSON.stringify(row.context, null, 2)}
                            </pre>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              : null}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  暂无错误记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!loading && nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-md border border-secondary px-4 py-2 text-sm hover:bg-muted/50 disabled:opacity-50"
            onClick={() => void loadMore()}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                加载中…
              </>
            ) : (
              `加载更多（每批 ${PAGE_SIZE} 条）`
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
