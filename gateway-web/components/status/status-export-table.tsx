"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayLogRow } from "@/components/logs/logs-table";
import { billingCategoryLabel } from "@/lib/billing-category-labels";
import {
  gatewayFailMessageDisplay,
  resolveGatewayFailCodeDisplay,
} from "@/lib/gateway-log-fail";
import {
  clampGatewayLogPageSize,
  GATEWAY_LOG_PAGE_SIZE_DEFAULT,
  persistGatewayLogPageSize,
  readStoredGatewayLogPageSize,
  resolveGatewayLogPageSizePreset,
  type GatewayLogPageSizePreset,
} from "@/lib/gateway-log-pagination-config";
import { formatDurationSeconds, formatLogTimestamp } from "@/lib/gateway-log-params";

const INFINITE_SCROLL_MAX_ROWS = 500;

type StatusLogRow = GatewayLogRow & {
  billingCategory?: string | null;
  actorPhone?: string | null;
  actorName?: string | null;
  actorDisplayLabel?: string | null;
};

type LogsResponse = {
  logs: StatusLogRow[];
  total: number | null;
  page: number;
  pageSize: number;
  totalPages: number | null;
  hasMore?: boolean;
};

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function StatusExportTable({ queryString }: { queryString: string }) {
  const [rows, setRows] = useState<StatusLogRow[]>([]);
  const [pageSize, setPageSize] = useState<number>(GATEWAY_LOG_PAGE_SIZE_DEFAULT);
  const [pageSizePreset, setPageSizePreset] = useState<GatewayLogPageSizePreset>(
    GATEWAY_LOG_PAGE_SIZE_DEFAULT,
  );
  const [customPageSizeInput, setCustomPageSizeInput] = useState(
    String(GATEWAY_LOG_PAGE_SIZE_DEFAULT),
  );
  const [loadedPages, setLoadedPages] = useState(1);
  const [hasMoreRows, setHasMoreRows] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const loadedPagesRef = useRef(1);
  const hasMoreRowsRef = useRef(true);
  const rowsRef = useRef(rows);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  rowsRef.current = rows;
  loadedPagesRef.current = loadedPages;
  hasMoreRowsRef.current = hasMoreRows;

  useEffect(() => {
    const stored = readStoredGatewayLogPageSize();
    setPageSize(stored);
    setPageSizePreset(resolveGatewayLogPageSizePreset(stored));
    setCustomPageSizeInput(String(stored));
  }, []);

  const applyPageSize = useCallback((size: number) => {
    const clamped = clampGatewayLogPageSize(size);
    setPageSize(clamped);
    setPageSizePreset(resolveGatewayLogPageSizePreset(clamped));
    setCustomPageSizeInput(String(clamped));
    persistGatewayLogPageSize(clamped);
    setLoadedPages(1);
    loadedPagesRef.current = 1;
    setHasMoreRows(true);
    hasMoreRowsRef.current = true;
  }, []);

  const loadRows = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = opts?.append === true;
      if (
        append &&
        (!hasMoreRowsRef.current ||
          rowsRef.current.length >= INFINITE_SCROLL_MAX_ROWS)
      ) {
        return;
      }

      const targetPage = append ? loadedPagesRef.current + 1 : 1;
      const seq = ++seqRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const qs = new URLSearchParams(queryString);
      qs.set("page", String(targetPage));
      qs.set("limit", String(pageSize));
      qs.set("skipCount", "1");
      qs.set("skipPoll", "1");

      try {
        const res = await fetch(
          `/api/book-mall/api/gateway/logs?${qs.toString()}`,
        );
        if (!res.ok) {
          if (seq !== seqRef.current) return;
          setError(`加载表格失败（${res.status}）`);
          return;
        }
        const data = (await res.json()) as LogsResponse;
        if (seq !== seqRef.current) return;

        const batch = data.logs ?? [];
        const pageHasMore = data.hasMore ?? batch.length === pageSize;

        if (append) {
          setRows((prev) => {
            const seen = new Set(prev.map((r) => r.id));
            const merged = [...prev];
            for (const row of batch) {
              if (!seen.has(row.id)) merged.push(row);
            }
            const capped = merged.slice(0, INFINITE_SCROLL_MAX_ROWS);
            setHasMoreRows(
              pageHasMore && capped.length < INFINITE_SCROLL_MAX_ROWS,
            );
            return capped;
          });
        } else {
          setRows(batch.slice(0, INFINITE_SCROLL_MAX_ROWS));
          setHasMoreRows(
            pageHasMore && batch.length < INFINITE_SCROLL_MAX_ROWS,
          );
        }

        setLoadedPages(targetPage);
        loadedPagesRef.current = targetPage;
      } catch {
        if (seq !== seqRef.current) return;
        setError("网络异常，请稍后重试");
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [queryString, pageSize],
  );

  useEffect(() => {
    setLoadedPages(1);
    loadedPagesRef.current = 1;
    setHasMoreRows(true);
    hasMoreRowsRef.current = true;
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loading || loadingMore || !hasMoreRowsRef.current) return;
        if (rowsRef.current.length >= INFINITE_SCROLL_MAX_ROWS) return;
        void loadRows({ append: true });
      },
      { rootMargin: "320px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMoreRows, rows.length, loadRows]);

  const downloadCsv = () => {
    const qs = new URLSearchParams(queryString);
    qs.set("format", "csv");
    qs.set("limit", "2000");
    const url = `/api/book-mall/api/gateway/logs/export?${qs.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gw-border)] px-4 py-3">
        <div>
          <h2>明细表格</h2>
          <p className="mt-0.5 text-xs text-[var(--gw-muted)]">
            与当前筛选一致 · 首屏加载后滚动追加（skipCount）
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLoadedPages(1);
              loadedPagesRef.current = 1;
              setHasMoreRows(true);
              hasMoreRowsRef.current = true;
              void loadRows();
            }}
            disabled={loading}
            className="rounded-md border border-[var(--gw-border)] px-3 py-1.5 text-sm text-[var(--gw-ink)] hover:bg-[var(--gw-hover)] disabled:opacity-50"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={loading || rows.length === 0}
            className="gw-btn-sm"
          >
            下载 CSV
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-500/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="relative max-h-[480px] overflow-auto">
        {loading && rows.length > 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <SpinnerIcon className="h-6 w-6 text-[var(--gw-accent)]" />
          </div>
        ) : null}
        <table
          className={`min-w-full text-left text-sm ${
            loading && rows.length > 0 ? "opacity-50" : ""
          }`}
        >
          <thead>
            <tr className="gw-th-row border-b border-[var(--gw-border)]">
              <th className="w-12 px-3 py-2 text-right font-medium">#</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">失败码</th>
              <th className="px-3 py-2 font-medium">失败原因</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">类别</th>
              <th className="px-3 py-2 font-medium">手机号</th>
              <th className="px-3 py-2 font-medium">昵称</th>
              <th className="px-3 py-2 font-medium">用户名</th>
              <th className="px-3 py-2 font-medium">耗时</th>
              <th className="px-3 py-2 font-medium">提交时间</th>
              <th className="px-3 py-2 font-medium">ID</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-[var(--gw-muted)]">
                  <div className="inline-flex items-center gap-2">
                    <SpinnerIcon className="h-5 w-5 text-[var(--gw-accent)]" />
                    正在加载表格…
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-[var(--gw-muted)]">
                  当前筛选下暂无记录
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const failCode = resolveGatewayFailCodeDisplay({
                  failCode: row.failCode,
                  failMessage: row.failMessage,
                });
                const failMessage =
                  row.status === "FAILED"
                    ? gatewayFailMessageDisplay(row.failMessage, row.failCode)
                    : "—";
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--gw-border)] hover:bg-[var(--gw-hover)]"
                  >
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--gw-muted)]">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 lowercase text-[var(--gw-ink)]">
                      {row.status.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-red-300">
                      {row.status === "FAILED" ? failCode : "—"}
                    </td>
                    <td className="max-w-[240px] px-3 py-2 text-xs leading-relaxed text-[var(--gw-muted)]">
                      {failMessage}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs text-[var(--gw-ink)]">
                      {row.canonicalModelKey ?? row.model}
                    </td>
                    <td className="px-3 py-2 text-[var(--gw-muted)]">
                      {billingCategoryLabel(row.billingCategory)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--gw-ink)]">
                      {row.actorPhone ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--gw-ink)]">
                      {row.actorName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--gw-ink)]">
                      {row.actorDisplayLabel ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--gw-ink)]">
                      {row.durationMs != null
                        ? formatDurationSeconds(row.durationMs)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--gw-muted)]">
                      {formatLogTimestamp(row.submittedAt)}
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs text-[var(--gw-muted)]"
                      title={row.id}
                    >
                      {row.id.slice(0, 8)}…
                    </td>
                  </tr>
                );
              })
            )}
            {loadingMore ? (
              <tr>
                <td colSpan={12} className="px-4 py-3 text-center text-xs text-[var(--gw-accent)]/90">
                  正在加载更多…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div ref={loadMoreSentinelRef} className="h-1" aria-hidden />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--gw-border)] px-4 py-3 text-xs text-[var(--gw-muted)]">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            已加载 {rows.length} 条
            {loadedPages > 1 ? ` · 已翻 ${loadedPages} 页` : ""}
          </span>
          <span>|</span>
          <span>每批</span>
          <select
            value={pageSizePreset}
            onChange={(e) => {
              const next = e.target.value as GatewayLogPageSizePreset;
              setPageSizePreset(next);
              if (next === "custom") return;
              applyPageSize(Number(next));
            }}
            className="rounded-lg border border-[var(--gw-border)] bg-[#141419] px-2.5 py-1.5 text-xs text-[var(--gw-ink)] outline-none focus:border-white/20"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
            <option value="custom">自定义</option>
          </select>
          {pageSizePreset === "custom" ? (
            <label className="inline-flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={500}
                value={customPageSizeInput}
                onChange={(e) => setCustomPageSizeInput(e.target.value)}
                onBlur={() => applyPageSize(Number(customPageSizeInput))}
                className="w-20 rounded-lg border border-[var(--gw-border)] bg-[#141419] px-2 py-1.5 font-mono text-xs text-[var(--gw-ink)] outline-none focus:border-white/20"
              />
              条
            </label>
          ) : null}
        </div>
        <div>
          {loadingMore ? (
            <span className="text-[var(--gw-accent)]/90">正在加载更多…</span>
          ) : hasMoreRows && rows.length < INFINITE_SCROLL_MAX_ROWS ? (
            <span>向下滚动自动加载（每批 {pageSize} 条）</span>
          ) : rows.length >= INFINITE_SCROLL_MAX_ROWS ? (
            <span className="text-amber-300/90">已达单次加载上限，请缩小筛选范围</span>
          ) : (
            <span>已全部加载</span>
          )}
        </div>
      </div>
    </div>
  );
}
