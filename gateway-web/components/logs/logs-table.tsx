"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogImagesCell } from "./log-images-cell";
import { LogParamsCell } from "./log-params-cell";
import { LogResultCell } from "./log-result-cell";
import { LogStatusBadge } from "./log-status-badge";
import {
  formatDurationSeconds,
  formatTokenDisplay,
  formatUsageYuanDisplay,
  formatLogTimestamp,
  formatPlatformCreditsDisplay,
  isLogDateRangeInvalid,
  logSubmittedInUtcDateRange,
  pickLogProgressLabel,
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
  displayLogModelKey,
  logProviderFilterOptions,
  LOG_APP_FILTER_OPTIONS,
} from "@/lib/gateway-log-display";

export type GatewayLogRow = {
  id: string;
  model: string;
  canonicalModelKey?: string | null;
  tenantId?: string | null;
  actorBookUserId?: string | null;
  creditsCharged?: number | null;
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

const AUTO_REFRESH_MS = 10_000;
const LIVE_CLOCK_MS = 1_000;

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12a9 9 0 11-2.64-6.36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 3v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function fetchGatewayLogs(params: {
  hasDateFilter: boolean;
  fromDate: string;
  toDate: string;
}): Promise<GatewayLogRow[]> {
  const qs = new URLSearchParams({
    limit: params.hasDateFilter ? "200" : "100",
  });
  if (params.fromDate) qs.set("from", params.fromDate);
  if (params.toDate) qs.set("to", params.toDate);
  const res = await fetch(`/api/book-mall/api/gateway/logs?${qs.toString()}`);
  const data = (await res.json().catch(() => null)) as {
    logs?: GatewayLogRow[];
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? "加载日志失败");
  }
  return data?.logs ?? [];
}

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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [liveClockTick, setLiveClockTick] = useState(0);

  const dateRangeInvalid = isLogDateRangeInvalid(fromDate, toDate);
  const hasDateFilter = !!(fromDate || toDate);

  const hasInFlightLogs = useMemo(
    () => logs.some((l) => l.status === "RUNNING" || l.status === "PENDING"),
    [logs],
  );

  const refreshLogs = useCallback(async () => {
    setRefreshing(true);
    setFetchError(null);
    try {
      const next = await fetchGatewayLogs({ hasDateFilter, fromDate, toDate });
      setLogs(next);
      setLastRefreshedAt(new Date());
      return next;
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "加载日志失败");
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [hasDateFilter, fromDate, toDate]);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  /** 进行中任务 · 本地每秒刷新 Duration 列 */
  useEffect(() => {
    if (!hasInFlightLogs) return;
    const timer = window.setInterval(() => {
      setLiveClockTick((n) => n + 1);
    }, LIVE_CLOCK_MS);
    return () => window.clearInterval(timer);
  }, [hasInFlightLogs]);

  /** 有进行中任务时每 10s 拉取（服务端 opportunistic 轮询厂商任务） */
  useEffect(() => {
    if (!autoRefresh || !hasInFlightLogs) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await refreshLogs();
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, AUTO_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [autoRefresh, hasInFlightLogs, refreshLogs]);

  useEffect(() => {
    if (!hasDateFilter) {
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
          const next = await fetchGatewayLogs({ hasDateFilter, fromDate, toDate });
          if (cancelled) return;
          setLogs(next);
          setLastRefreshedAt(new Date());
        } catch (e) {
          if (!cancelled) {
            setFetchError(e instanceof Error ? e.message : "加载日志失败");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fromDate, toDate, hasDateFilter, dateRangeInvalid]);

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
      if (modelFilter && displayLogModelKey(l) !== modelFilter) return false;
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
              {hasInFlightLogs && autoRefresh
                ? " · 自动刷新 10s"
                : hasInFlightLogs
                  ? " · 有进行中任务"
                  : ""}
              {lastRefreshedAt && !loading
                ? ` · 更新 ${lastRefreshedAt.toLocaleTimeString()}`
                : ""}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="mb-0.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-zinc-400 transition hover:border-white/20 hover:text-zinc-200">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-sky-500"
              />
              自动刷新
            </label>
            <button
              type="button"
              disabled={refreshing || loading}
              className="mb-0.5 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void refreshLogs()}
              title="立即刷新日志（进行中任务会触发服务端轮询）"
            >
              {refreshing ? (
                <SpinnerIcon className="size-3.5 animate-spin" />
              ) : (
                <RefreshIcon className="size-3.5" />
              )}
              刷新
            </button>
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
                按 Submitted 筛选，最多 200 条
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
                Usage ¥
              </th>
              <th
                className="w-[96px]"
                title="平台代付扣减积分（Finance 2.0 · 与 finance-web 扣减明细一致）"
              >
                Credits
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
              void liveClockTick;
              const isInProgress =
                l.status === "RUNNING" || l.status === "PENDING";
              const durationMs = resolveLogDurationMs(
                l.durationMs,
                l.submittedAt,
                l.completedAt,
                isInProgress ? { inProgress: true, nowMs: Date.now() } : undefined,
              );
              const duration = formatDurationSeconds(durationMs);
              const usage = formatUsageYuanDisplay(l.estimatedVendorCostYuan);
              const platformCredits = formatPlatformCreditsDisplay(l.creditsCharged);
              const tokens = formatTokenDisplay(
                l.totalTokens,
                l.promptTokens,
                l.completionTokens,
                l.metricsSource,
              );
              const taskId = l.externalTaskId ?? l.id;
              const progressLabel = isInProgress
                ? pickLogProgressLabel(l.status, l.resultSummary)
                : null;
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
                    <span
                      className="inline-flex rounded-md bg-sky-600 px-2 py-0.5 font-mono text-[11px] font-medium text-white"
                      title={
                        displayLogModelKey(l) !== l.model ? l.model : undefined
                      }
                    >
                      {displayLogModelKey(l)}
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
                      progressLabel={progressLabel}
                    />
                  </td>
                  <td
                    className="align-middle font-mono text-sm text-zinc-300"
                    title={
                      durationMs != null && durationMs > 0
                        ? `${durationMs} ms`
                        : isInProgress
                          ? progressLabel
                            ? `任务进行中 · ${progressLabel}`
                            : "任务进行中"
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
                    className="align-middle font-mono text-sm text-emerald-300/90"
                    title={
                      isInProgress
                        ? "任务进行中，完成后写入扣减积分"
                        : platformCredits.title
                    }
                  >
                    {isInProgress ? "—" : platformCredits.value}
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
                  colSpan={16}
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
