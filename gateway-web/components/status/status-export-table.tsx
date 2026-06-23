"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayLogRow } from "@/components/logs/logs-table";
import { GatewayLogPaginationBar } from "@/components/logs/gateway-log-pagination-bar";
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

type StatusLogRow = GatewayLogRow & {
  billingCategory?: string | null;
  actorPhone?: string | null;
  actorName?: string | null;
  actorDisplayLabel?: string | null;
};

type LogsResponse = {
  logs: StatusLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(GATEWAY_LOG_PAGE_SIZE_DEFAULT);
  const [pageSizePreset, setPageSizePreset] = useState<GatewayLogPageSizePreset>(
    GATEWAY_LOG_PAGE_SIZE_DEFAULT,
  );
  const [customPageSizeInput, setCustomPageSizeInput] = useState(
    String(GATEWAY_LOG_PAGE_SIZE_DEFAULT),
  );
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const stored = readStoredGatewayLogPageSize();
    setPageSize(stored);
    setPageSizePreset(resolveGatewayLogPageSizePreset(stored));
    setCustomPageSizeInput(String(stored));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [queryString, pageSize]);

  const applyPageSize = useCallback((size: number) => {
    const clamped = clampGatewayLogPageSize(size);
    setPageSize(clamped);
    setPageSizePreset(resolveGatewayLogPageSizePreset(clamped));
    setCustomPageSizeInput(String(clamped));
    persistGatewayLogPageSize(clamped);
    setPage(1);
  }, []);

  const loadRows = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams(queryString);
    qs.set("page", String(page));
    qs.set("limit", String(pageSize));
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
      setRows(data.logs ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      if (typeof data.page === "number") setPage(data.page);
    } catch {
      if (seq !== seqRef.current) return;
      setError("网络异常，请稍后重试");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [queryString, page, pageSize]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

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
          <h2 className="text-sm font-medium text-[var(--gw-ink)]">明细表格</h2>
          <p className="mt-0.5 text-xs text-[var(--gw-muted)]">
            与当前筛选一致 · 分页规则同 Gateway 日志页
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadRows()}
            disabled={loading}
            className="rounded-md border border-[var(--gw-border)] px-3 py-1.5 text-sm text-[var(--gw-ink)] hover:bg-[var(--gw-hover)] disabled:opacity-50"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={loading || total === 0}
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

      <div className="relative overflow-x-auto">
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
            <tr className="border-b border-[var(--gw-border)] text-xs uppercase text-[var(--gw-muted)]">
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
                const rowNo = (page - 1) * pageSize + index + 1;
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
                      {rowNo}
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
          </tbody>
        </table>
      </div>

      <GatewayLogPaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        rowCount={rows.length}
        pageSize={pageSize}
        pageSizePreset={pageSizePreset}
        customPageSizeInput={customPageSizeInput}
        loading={loading}
        onPageChange={setPage}
        onPageSizePresetChange={setPageSizePreset}
        onCustomPageSizeInputChange={setCustomPageSizeInput}
        onApplyCustomPageSize={applyPageSize}
      />
    </div>
  );
}
