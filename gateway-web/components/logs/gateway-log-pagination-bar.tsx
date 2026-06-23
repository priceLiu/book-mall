"use client";

import {
  clampGatewayLogPageSize,
  GATEWAY_LOG_PAGE_SIZE_MAX,
  GATEWAY_LOG_PAGE_SIZE_PRESETS,
  type GatewayLogPageSizePreset,
} from "@/lib/gateway-log-pagination-config";

export function GatewayLogPaginationBar({
  page,
  totalPages,
  total,
  rowCount,
  pageSize,
  pageSizePreset,
  customPageSizeInput,
  loading,
  onPageChange,
  onPageSizePresetChange,
  onCustomPageSizeInputChange,
  onApplyCustomPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  rowCount: number;
  pageSize: number;
  pageSizePreset: GatewayLogPageSizePreset;
  customPageSizeInput: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizePresetChange: (preset: GatewayLogPageSizePreset) => void;
  onApplyCustomPageSize: (size: number) => void;
  onCustomPageSizeInputChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--gw-border)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--gw-muted)]">
        <span>
          共 {total} 条 · 第 {page}/{totalPages} 页 · 本页 {rowCount} 条
        </span>
        <span className="text-[var(--gw-muted)]">|</span>
        <span>每页</span>
        <select
          value={pageSizePreset}
          onChange={(e) => {
            const next = e.target.value as GatewayLogPageSizePreset;
            onPageSizePresetChange(next);
            if (next === "custom") return;
            onApplyCustomPageSize(Number(next));
          }}
          className="rounded-lg border border-[var(--gw-border)] bg-[#141419] px-2.5 py-1.5 text-xs text-[var(--gw-ink)] outline-none focus:border-white/20"
          aria-label="每页条数"
        >
          {GATEWAY_LOG_PAGE_SIZE_PRESETS.map((n) => (
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
              max={GATEWAY_LOG_PAGE_SIZE_MAX}
              value={customPageSizeInput}
              onChange={(e) => onCustomPageSizeInputChange(e.target.value)}
              onBlur={() => {
                onApplyCustomPageSize(clampGatewayLogPageSize(Number(customPageSizeInput)));
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                onApplyCustomPageSize(clampGatewayLogPageSize(Number(customPageSizeInput)));
              }}
              className="w-20 rounded-lg border border-[var(--gw-border)] bg-[#141419] px-2 py-1.5 font-mono text-xs text-[var(--gw-ink)] outline-none focus:border-white/20"
              aria-label="自定义每页条数"
            />
            条
          </label>
        ) : null}
        <span className="text-[11px] text-[var(--gw-muted)]">
          最多 {GATEWAY_LOG_PAGE_SIZE_MAX} 条/页
        </span>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="rounded-lg border border-[var(--gw-border)] px-3 py-1.5 text-xs text-[var(--gw-muted)] transition hover:border-white/20 hover:bg-[var(--gw-hover)] hover:text-[var(--gw-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-xs text-[var(--gw-muted)]">
            第 {page} / {totalPages} 页
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="rounded-lg border border-[var(--gw-border)] px-3 py-1.5 text-xs text-[var(--gw-muted)] transition hover:border-white/20 hover:bg-[var(--gw-hover)] hover:text-[var(--gw-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}
