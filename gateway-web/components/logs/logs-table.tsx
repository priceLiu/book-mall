"use client";

import { useEffect, useMemo, useState } from "react";
import { LogImagesCell } from "./log-images-cell";
import { LogParamsCell } from "./log-params-cell";
import { LogResultCell } from "./log-result-cell";
import { LogStatusBadge } from "./log-status-badge";
import {
  formatDurationSeconds,
  formatTokenDisplay,
  formatUsageYuanDisplay,
  formatLogTimestamp,
  isLogDateRangeInvalid,
  logSubmittedInUtcDateRange,
  resolveLogDurationMs,
} from "@/lib/gateway-log-params";
import {
  collectLogCredentialKeys,
  collectLogModels,
  collectLogProviderKinds,
  formatLogCredentialKeyMasked,
  formatLogPageLabel,
  formatLogSourceTooltip,
  formatProviderKindLabel,
  logProviderFilterOptions,
  LOG_APP_FILTER_OPTIONS,
} from "@/lib/gateway-log-display";

export type GatewayLogRow = {
  id: string;
  model: string;
  endpoint: string;
  status: string;
  requestKind: string;
  providerKind: string | null;
  credentialKeyMasked: string | null;
  clientSource: string;
  clientPage: string | null;
  externalTaskId: string | null;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  metricsSource?: string | null;
  durationMs: number | null;
  estimatedVendorCostYuan: string | null;
  failCode: string | null;
  failMessage: string | null;
  inputSummary: unknown;
  resultSummary: unknown;
  submittedAt: string;
  completedAt: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "Select Status" },
  { value: "RUNNING", label: "running" },
  { value: "PENDING", label: "pending" },
  { value: "SUCCEEDED", label: "success" },
  { value: "FAILED", label: "failed" },
  { value: "CANCELLED", label: "cancelled" },
];

function logFilterChipClass(active: boolean): string {
  return active
    ? "rounded-lg border border-sky-500/45 bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-100"
    : "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200";
}

function clearSelectionOnFilter(setSelected: (s: Set<string>) => void) {
  setSelected(new Set());
}

export function LogsTable({ initialLogs }: { initialLogs: GatewayLogRow[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [sourceFilter, setSourceFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [credentialKeyFilter, setCredentialKeyFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const dateRangeInvalid = isLogDateRangeInvalid(fromDate, toDate);
  const hasDateFilter = !!(fromDate || toDate);

  const hasInFlightLogs = useMemo(
    () => logs.some((l) => l.status === "RUNNING" || l.status === "PENDING"),
    [logs],
  );

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  /** 有进行中任务时定时拉取日志（服务端会 opportunistic 轮询厂商任务） */
  useEffect(() => {
    if (!hasInFlightLogs) return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const params = new URLSearchParams({
          limit: hasDateFilter ? "100" : "50",
        });
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        const res = await fetch(
          `/api/book-mall/api/gateway/logs?${params.toString()}`,
        );
        const data = (await res.json().catch(() => null)) as {
          logs?: GatewayLogRow[];
        } | null;
        if (cancelled || !res.ok) return;
        setLogs(data?.logs ?? []);
      } catch {
        /* 静默；用户可手动刷新页面 */
      }
    };

    const timer = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasInFlightLogs, hasDateFilter, fromDate, toDate]);

  useEffect(() => {
    if (!hasDateFilter) {
      setLogs(initialLogs);
      setFetchError(null);
      setLoading(false);
      return;
    }
    if (dateRangeInvalid) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setFetchError(null);
        try {
          const params = new URLSearchParams({ limit: "100" });
          if (fromDate) params.set("from", fromDate);
          if (toDate) params.set("to", toDate);
          const res = await fetch(
            `/api/book-mall/api/gateway/logs?${params.toString()}`,
          );
          const data = (await res.json().catch(() => null)) as {
            logs?: GatewayLogRow[];
            error?: string;
          } | null;
          if (cancelled) return;
          if (!res.ok) {
            setFetchError(data?.error ?? "加载日志失败");
            return;
          }
          setLogs(data?.logs ?? []);
        } catch {
          if (!cancelled) setFetchError("加载日志失败");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fromDate, toDate, hasDateFilter, dateRangeInvalid, initialLogs]);

  const providerKinds = useMemo(
    () => logProviderFilterOptions(collectLogProviderKinds(logs)),
    [logs],
  );

  const modelOptions = useMemo(
    () => collectLogModels(logs, providerFilter || undefined),
    [logs, providerFilter],
  );

  const credentialKeyOptions = useMemo(
    () => collectLogCredentialKeys(logs, providerFilter || undefined),
    [logs, providerFilter],
  );

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (
        hasDateFilter &&
        !dateRangeInvalid &&
        !logSubmittedInUtcDateRange(l.submittedAt, fromDate, toDate)
      ) {
        return false;
      }
      if (sourceFilter && l.clientSource !== sourceFilter) return false;
      if (providerFilter && l.providerKind !== providerFilter) return false;
      if (modelFilter && l.model !== modelFilter) return false;
      if (
        credentialKeyFilter &&
        l.credentialKeyMasked !== credentialKeyFilter
      ) {
        return false;
      }
      if (statusFilter && l.status !== statusFilter) return false;
      return true;
    });
  }, [
    logs,
    hasDateFilter,
    dateRangeInvalid,
    fromDate,
    toDate,
    sourceFilter,
    providerFilter,
    modelFilter,
    credentialKeyFilter,
    statusFilter,
  ]);

  const allSelected =
    filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((l) => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-[#0f0f14] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="mr-1 shrink-0 text-xs text-zinc-500">应用</span>
            {LOG_APP_FILTER_OPTIONS.map((opt) => {
              const active = sourceFilter === opt.value;
              return (
                <button
                  key={opt.value || "all"}
                  type="button"
                  className={logFilterChipClass(active)}
                  onClick={() => {
                    setSourceFilter(opt.value);
                    clearSelectionOnFilter(setSelected);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            <span className="ml-2 shrink-0 text-[11px] text-zinc-600">
              {loading
                ? "加载中…"
                : `${filtered.length} / ${logs.length} 条`}
              {hasDateFilter && !loading ? " · 按日期" : ""}
              {hasInFlightLogs ? " · 进行中任务每 10s 刷新" : ""}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex flex-wrap items-end justify-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">开始日期</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    clearSelectionOnFilter(setSelected);
                  }}
                  className="w-[148px] rounded-lg border border-white/10 bg-[#141419] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-white/20 [color-scheme:dark]"
                  aria-label="开始日期"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">结束日期</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    clearSelectionOnFilter(setSelected);
                  }}
                  className="w-[148px] rounded-lg border border-white/10 bg-[#141419] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-white/20 [color-scheme:dark]"
                  aria-label="结束日期"
                />
              </label>
              {fromDate || toDate ? (
                <button
                  type="button"
                  className="mb-0.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                    clearSelectionOnFilter(setSelected);
                  }}
                >
                  清除
                </button>
              ) : null}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  clearSelectionOnFilter(setSelected);
                }}
                className="mb-0.5 min-w-[160px] rounded-lg border border-white/10 bg-[#141419] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-white/20"
                aria-label="按状态筛选"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {dateRangeInvalid ? (
              <span className="text-xs text-amber-400/90">
                结束日期不能早于开始日期
              </span>
            ) : fetchError ? (
              <span className="text-xs text-red-400/90">{fetchError}</span>
            ) : hasDateFilter && !loading ? (
              <span className="text-[11px] text-zinc-600">
                按 Submitted 筛选，最多 100 条
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2.5">
          <span className="mr-1 shrink-0 text-xs text-zinc-500">厂商</span>
          <button
            type="button"
            className={logFilterChipClass(!providerFilter)}
            onClick={() => {
              setProviderFilter("");
              setModelFilter("");
              setCredentialKeyFilter("");
              clearSelectionOnFilter(setSelected);
            }}
          >
            全部
          </button>
          {providerKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className={logFilterChipClass(providerFilter === kind)}
              onClick={() => {
                setProviderFilter(kind);
                setModelFilter("");
                setCredentialKeyFilter("");
                clearSelectionOnFilter(setSelected);
              }}
            >
              {formatProviderKindLabel(kind)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2.5">
          <span className="shrink-0 text-xs text-zinc-500">模型</span>
          <select
            value={modelFilter}
            onChange={(e) => {
              setModelFilter(e.target.value);
              clearSelectionOnFilter(setSelected);
            }}
            disabled={!modelOptions.length}
            className="min-w-[min(100%,320px)] max-w-xl flex-1 rounded-lg border border-white/10 bg-[#141419] px-3 py-2 font-mono text-xs text-zinc-300 outline-none focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="按模型筛选"
          >
            <option value="">全部模型</option>
            {modelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {providerFilter ? (
            <span className="shrink-0 text-[11px] text-zinc-600">
              已按 {formatProviderKindLabel(providerFilter)} 收窄
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2.5">
          <span className="shrink-0 text-xs text-zinc-500">渠道 Key</span>
          <select
            value={credentialKeyFilter}
            onChange={(e) => {
              setCredentialKeyFilter(e.target.value);
              clearSelectionOnFilter(setSelected);
            }}
            disabled={!credentialKeyOptions.length}
            className="min-w-[min(100%,280px)] max-w-md flex-1 rounded-lg border border-white/10 bg-[#141419] px-3 py-2 font-mono text-xs text-zinc-300 outline-none focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="按渠道 Key 筛选"
          >
            <option value="">全部 Key</option>
            {credentialKeyOptions.map((key) => (
              <option key={key} value={key}>
                {formatLogCredentialKeyMasked(key)}
              </option>
            ))}
          </select>
          {!credentialKeyOptions.length ? (
            <span className="shrink-0 text-[11px] text-zinc-600">
              当前批次无渠道 Key 记录
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0f0f14]">
        <table className="gw-logs-table min-w-[2100px]">
          <thead>
            <tr>
              <th className="w-11">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-sky-500"
                  aria-label="全选"
                />
              </th>
              <th className="w-[88px]">Source</th>
              <th className="min-w-[168px]">Model</th>
              <th
                className="min-w-[140px]"
                title="实际路由的厂商凭证 Key（脱敏）"
              >
                Key
              </th>
              <th className="min-w-[480px]">Params</th>
              <th className="min-w-[280px]">Images</th>
              <th className="w-[120px]">Status</th>
              <th className="w-[88px]">Duration</th>
              <th className="min-w-[168px]">Submitted</th>
              <th className="min-w-[168px]">Completed</th>
              <th
                className="w-[100px]"
                title="挂牌参考费用（元），供后续费用统计；非钱包扣点。"
              >
                Usage
              </th>
              <th
                className="w-[110px]"
                title="Token 计量：厂商回传优先；异步任务按 prompt 文本平台估算。"
              >
                Token
              </th>
              <th className="min-w-[240px]">Task ID</th>
              <th className="w-[150px]">Results</th>
              <th className="w-[120px]">Retry Callback</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const durationMs = resolveLogDurationMs(
                l.durationMs,
                l.submittedAt,
                l.completedAt,
              );
              const duration = formatDurationSeconds(durationMs);
              const usage = formatUsageYuanDisplay(l.estimatedVendorCostYuan);
              const tokens = formatTokenDisplay(
                l.totalTokens,
                l.promptTokens,
                l.completionTokens,
                l.metricsSource,
              );
              const taskId = l.externalTaskId ?? l.id;
              const isInProgress =
                l.status === "RUNNING" || l.status === "PENDING";
              const sourceLabel = formatLogPageLabel(l.clientSource, l.clientPage);
              const sourceTitle = formatLogSourceTooltip(
                l.clientSource,
                l.providerKind,
                l.clientPage,
              );

              return (
                <tr key={l.id} className="gw-logs-row">
                  <td className="align-middle">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggleOne(l.id)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-sky-500"
                      aria-label={`选择 ${l.id}`}
                    />
                  </td>
                  <td className="align-middle">
                    <span
                      className="text-sm text-zinc-300"
                      title={sourceTitle}
                    >
                      {sourceLabel}
                    </span>
                  </td>
                  <td className="align-top">
                    <span className="inline-flex rounded-md bg-sky-600 px-2 py-0.5 font-mono text-[11px] font-medium text-white">
                      {l.model}
                    </span>
                  </td>
                  <td className="align-middle">
                    <span
                      className="font-mono text-[11px] text-zinc-400"
                      title={l.credentialKeyMasked ?? undefined}
                    >
                      {formatLogCredentialKeyMasked(l.credentialKeyMasked)}
                    </span>
                  </td>
                  <td className="align-top">
                    <LogParamsCell inputSummary={l.inputSummary} />
                  </td>
                  <td className="align-top">
                    <LogImagesCell inputSummary={l.inputSummary} />
                  </td>
                  <td className="align-middle">
                    <LogStatusBadge
                      status={l.status}
                      failCode={l.failCode}
                      failMessage={l.failMessage}
                    />
                  </td>
                  <td
                    className="align-middle font-mono text-sm text-zinc-300"
                    title={
                      durationMs != null && durationMs > 0
                        ? `${durationMs} ms`
                        : isInProgress
                          ? "任务进行中"
                          : durationMs != null
                            ? `${durationMs} ms（由完成时间推算）`
                            : undefined
                    }
                  >
                    {duration}
                  </td>
                  <td className="align-middle">
                    <span
                      className="block whitespace-nowrap font-mono text-[11px] leading-snug text-zinc-400"
                      title={l.submittedAt}
                    >
                      {formatLogTimestamp(l.submittedAt)}
                    </span>
                  </td>
                  <td className="align-middle">
                    {l.completedAt ? (
                      <span
                        className="block whitespace-nowrap font-mono text-[11px] leading-snug text-zinc-400"
                        title={l.completedAt}
                      >
                        {formatLogTimestamp(l.completedAt)}
                      </span>
                    ) : (
                      <span
                        className="text-sm text-zinc-600"
                        title={isInProgress ? "任务进行中" : undefined}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td
                    className="align-middle font-mono text-sm text-zinc-300"
                    title={
                      isInProgress ? "任务进行中，完成后写入费用估算" : usage.title
                    }
                  >
                    {isInProgress ? "—" : usage.value}
                  </td>
                  <td
                    className="align-middle font-mono text-sm text-zinc-300"
                    title={
                      isInProgress ? "任务进行中，完成后写入 Token" : tokens.title
                    }
                  >
                    {isInProgress ? "—" : tokens.value}
                  </td>
                  <td className="align-middle">
                    <span
                      className="block break-all font-mono text-[11px] leading-snug text-zinc-400"
                      title={taskId}
                    >
                      {taskId}
                    </span>
                  </td>
                  <td className="align-middle">
                    <LogResultCell
                      status={l.status}
                      resultSummary={l.resultSummary}
                    />
                  </td>
                  <td className="align-middle text-center text-zinc-600">
                    —
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr>
                <td
                  colSpan={15}
                  className="py-16 text-center text-sm text-zinc-500"
                >
                  {logs.length
                    ? "暂无符合筛选条件的日志"
                    : "暂无日志"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
