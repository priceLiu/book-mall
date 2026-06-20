"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  pickLogProgressLabel,
  resolveLogDurationMs,
} from "@/lib/gateway-log-params";
import {
  collectLogModels,
  collectLogProviderKinds,
  formatLogCredentialKeyMasked,
  formatLogMonospaceId,
  formatLogPageLabel,
  formatLogSourceTooltip,
  formatProviderKindLabel,
  displayLogModelKey,
  formatLogAppTaskCell,
  formatLogTimingPhaseCell,
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
  vendorRequestId?: string | null;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  metricsSource?: string | null;
  durationMs: number | null;
  vendorDurationMs?: number | null;
  storyTaskId?: string | null;
  appTaskId?: string | null;
  appTaskKind?: string | null;
  appTaskNodeId?: string | null;
  queueMs?: number | null;
  generateMs?: number | null;
  pollDelayMs?: number | null;
  pollDelayOverLimit?: boolean;
  estimatedVendorCostYuan: string | null;
  failCode: string | null;
  failMessage: string | null;
  billingCategory?: string | null;
  storyProjectId?: string | null;
  inputSummary: unknown;
  resultSummary: unknown;
  submittedAt: string;
  completedAt: string | null;
  credentialId?: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "Select Status" },
  { value: "RUNNING", label: "running" },
  { value: "PENDING", label: "pending" },
  { value: "SUCCEEDED", label: "success" },
  { value: "FAILED", label: "failed" },
  { value: "CANCELLED", label: "cancelled" },
];

const PAGE_SIZE_PRESETS = [20, 50, 100] as const;
const PAGE_SIZE_STORAGE_KEY = "gw-logs-page-size";
const PAGE_SIZE_MAX = 500;

type PageSizePreset = (typeof PAGE_SIZE_PRESETS)[number] | "custom";

type GatewayLogFacets = {
  models: string[];
  providerKinds: string[];
  credentialKeys: { id: string; masked: string }[];
};

type GatewayLogsResponse = {
  logs: GatewayLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: GatewayLogFacets;
};

export type GatewayLogsInitialData = {
  logs: GatewayLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: GatewayLogFacets;
};

function readStoredPageSize(): number {
  if (typeof window === "undefined") return PAGE_SIZE_PRESETS[0];
  try {
    const raw = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= PAGE_SIZE_MAX) return Math.floor(n);
  } catch {
    /* ignore */
  }
  return PAGE_SIZE_PRESETS[0];
}

function resolvePageSizePreset(size: number): PageSizePreset {
  return PAGE_SIZE_PRESETS.includes(size as (typeof PAGE_SIZE_PRESETS)[number])
    ? (size as (typeof PAGE_SIZE_PRESETS)[number])
    : "custom";
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return PAGE_SIZE_PRESETS[0];
  return Math.min(PAGE_SIZE_MAX, Math.floor(value));
}

const AUTO_REFRESH_MS = 8_000;
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
  page: number;
  pageSize: number;
  fromDate: string;
  toDate: string;
  statusFilter: string;
  sourceFilter: string;
  providerFilter: string;
  modelFilter: string;
  credentialIdFilter: string;
  skipPoll?: boolean;
  poll?: boolean;
}): Promise<GatewayLogsResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.pageSize),
  });
  if (params.fromDate) qs.set("from", params.fromDate);
  if (params.toDate) qs.set("to", params.toDate);
  if (params.statusFilter) qs.set("status", params.statusFilter);
  if (params.sourceFilter) qs.set("clientSource", params.sourceFilter);
  if (params.providerFilter) qs.set("providerKind", params.providerFilter);
  if (params.modelFilter) qs.set("model", params.modelFilter);
  if (params.credentialIdFilter) qs.set("credentialId", params.credentialIdFilter);
  if (params.skipPoll !== false) qs.set("skipPoll", "1");
  if (params.poll) qs.set("poll", "1");
  const res = await fetch(`/api/book-mall/api/gateway/logs?${qs.toString()}`);
  const data = (await res.json().catch(() => null)) as
    | (GatewayLogsResponse & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(data?.error ?? "加载日志失败");
  }
  return {
    logs: data?.logs ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? params.page,
    pageSize: data?.pageSize ?? params.pageSize,
    totalPages: data?.totalPages ?? 1,
    facets: data?.facets,
  };
}

function logFilterChipClass(active: boolean): string {
  return active
    ? "rounded-lg border border-sky-500/45 bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-100"
    : "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200";
}

function clearSelectionOnFilter(setSelected: (s: Set<string>) => void) {
  setSelected(new Set());
}

export function LogsTable({ initialData }: { initialData: GatewayLogsInitialData }) {
  const [logs, setLogs] = useState(initialData.logs);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(initialData.page || 1);
  const [totalPages, setTotalPages] = useState(initialData.totalPages || 1);
  const [pageSize, setPageSize] = useState(initialData.pageSize || PAGE_SIZE_PRESETS[0]);
  const [pageSizePreset, setPageSizePreset] = useState<PageSizePreset>(
    resolvePageSizePreset(initialData.pageSize || PAGE_SIZE_PRESETS[0]),
  );
  const [customPageSizeInput, setCustomPageSizeInput] = useState(
    String(initialData.pageSize || PAGE_SIZE_PRESETS[0]),
  );
  const [facets, setFacets] = useState<GatewayLogFacets>(
    initialData.facets ?? { models: [], providerKinds: [], credentialKeys: [] },
  );
  const [sourceFilter, setSourceFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [credentialIdFilter, setCredentialIdFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  /** 仅客户端更新，避免进行中 Duration 在 SSR/ hydration 时用 Date.now() 不一致 */
  const [liveNowMs, setLiveNowMs] = useState<number | null>(null);

  const dateRangeInvalid = isLogDateRangeInvalid(fromDate, toDate);

  const skipInitialFetchRef = useRef(true);

  const fetchParams = useMemo(
    () => ({
      page,
      pageSize,
      fromDate,
      toDate,
      statusFilter,
      sourceFilter,
      providerFilter,
      modelFilter,
      credentialIdFilter,
    }),
    [
      page,
      pageSize,
      fromDate,
      toDate,
      statusFilter,
      sourceFilter,
      providerFilter,
      modelFilter,
      credentialIdFilter,
    ],
  );

  const filtersAreDefault =
    !sourceFilter &&
    !providerFilter &&
    !modelFilter &&
    !credentialIdFilter &&
    !statusFilter &&
    !fromDate &&
    !toDate;

  const hasInFlightLogs = useMemo(
    () => logs.some((l) => l.status === "RUNNING" || l.status === "PENDING"),
    [logs],
  );

  const loadLogs = useCallback(async (opts?: { poll?: boolean }) => {
    setFetchError(null);
    try {
      const data = await fetchGatewayLogs({
        ...fetchParams,
        skipPoll: !opts?.poll,
        poll: opts?.poll,
      });
      setLogs(data.logs);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setPageSize(data.pageSize);
      if (data.facets) setFacets(data.facets);
      setLastRefreshedAt(new Date());
      return data;
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "加载日志失败");
      return null;
    }
  }, [fetchParams]);

  const refreshLogs = useCallback(async () => {
    setRefreshing(true);
    try {
      return await loadLogs({ poll: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadLogs]);

  useEffect(() => {
    setLogs(initialData.logs);
    setTotal(initialData.total);
    setPage(initialData.page || 1);
    setTotalPages(initialData.totalPages || 1);
    setPageSize(initialData.pageSize || PAGE_SIZE_PRESETS[0]);
    if (initialData.facets) setFacets(initialData.facets);
  }, [initialData]);

  useEffect(() => {
    const stored = readStoredPageSize();
    if (stored !== initialData.pageSize) {
      setPageSize(stored);
      setPageSizePreset(resolvePageSizePreset(stored));
      setCustomPageSizeInput(String(stored));
      setPage(1);
      skipInitialFetchRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时恢复每页条数
  }, []);

  /** 进行中任务 · 挂载后再用本地时钟刷新 Duration 列（禁止 SSR 阶段读 Date.now） */
  useEffect(() => {
    setLiveNowMs(Date.now());
    if (!hasInFlightLogs) return;
    const timer = window.setInterval(() => {
      setLiveNowMs(Date.now());
    }, LIVE_CLOCK_MS);
    return () => window.clearInterval(timer);
  }, [hasInFlightLogs]);

  /** 有进行中任务时每 10s 拉取（服务端 opportunistic 轮询厂商任务） */
  useEffect(() => {
    if (!autoRefresh || !hasInFlightLogs) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadLogs({ poll: true });
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, AUTO_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [autoRefresh, hasInFlightLogs, loadLogs]);

  /** 筛选 / 分页 / 每页条数变更时拉取 */
  useEffect(() => {
    if (dateRangeInvalid) return;

    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      if (
        filtersAreDefault &&
        page === (initialData.page || 1) &&
        pageSize === (initialData.pageSize || PAGE_SIZE_PRESETS[0])
      ) {
        return;
      }
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setFetchError(null);
        try {
          const data = await fetchGatewayLogs(fetchParams);
          if (cancelled) return;
          setLogs(data.logs);
          setTotal(data.total);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setPageSize(data.pageSize);
          if (data.facets) setFacets(data.facets);
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
  }, [fetchParams, dateRangeInvalid, filtersAreDefault, initialData.page, initialData.pageSize, page, pageSize]);

  const providerKinds = useMemo(() => {
    if (facets.providerKinds.length) {
      return logProviderFilterOptions(facets.providerKinds);
    }
    return logProviderFilterOptions(collectLogProviderKinds(logs));
  }, [facets.providerKinds, logs]);

  const modelOptions = useMemo(() => {
    if (facets.models.length) return facets.models;
    return collectLogModels(logs, providerFilter || undefined);
  }, [facets.models, logs, providerFilter]);

  const credentialKeyOptions = useMemo(() => {
    if (facets.credentialKeys.length) return facets.credentialKeys;
    const map = new Map<string, string>();
    for (const l of logs) {
      if (providerFilter && l.providerKind !== providerFilter) continue;
      if (l.credentialId && l.credentialKeyMasked) {
        map.set(l.credentialId, l.credentialKeyMasked);
      }
    }
    return [...map.entries()]
      .map(([id, masked]) => ({ id, masked }))
      .sort((a, b) => a.masked.localeCompare(b.masked));
  }, [facets.credentialKeys, logs, providerFilter]);

  const resetPage = () => setPage(1);

  const applyPageSize = (next: number) => {
    const clamped = clampPageSize(next);
    setPageSize(clamped);
    setPageSizePreset(resolvePageSizePreset(clamped));
    setCustomPageSizeInput(String(clamped));
    setPage(1);
    clearSelectionOnFilter(setSelected);
    try {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  };

  const allSelected =
    logs.length > 0 && logs.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(logs.map((l) => l.id)));
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
                    resetPage();
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
                : `共 ${total} 条 · 第 ${page}/${totalPages} 页 · 本页 ${logs.length} 条`}
              {(fromDate || toDate) && !loading ? " · 按日期" : ""}
              {hasInFlightLogs && autoRefresh
                ? " · 自动刷新 8s"
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
                    resetPage();
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
                    resetPage();
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
                    resetPage();
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
                  resetPage();
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
              setCredentialIdFilter("");
              resetPage();
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
                setCredentialIdFilter("");
                resetPage();
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
              resetPage();
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
            value={credentialIdFilter}
            onChange={(e) => {
              setCredentialIdFilter(e.target.value);
              resetPage();
              clearSelectionOnFilter(setSelected);
            }}
            disabled={!credentialKeyOptions.length}
            className="min-w-[min(100%,280px)] max-w-md flex-1 rounded-lg border border-white/10 bg-[#141419] px-3 py-2 font-mono text-xs text-zinc-300 outline-none focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="按渠道 Key 筛选"
          >
            <option value="">全部 Key</option>
            {credentialKeyOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {formatLogCredentialKeyMasked(item.masked)}
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
        <table className="gw-logs-table min-w-[3020px]">
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
              <th
                className="w-[88px]"
                title="Gateway 观测耗时：Submitted → Completed（或进行中为实时计时）。含火山排队与轮询间隔，非厂商控制台内的纯渲染秒数。"
              >
                Duration
              </th>
              <th
                className="w-[88px]"
                title="Gateway 提交 → 首次观测到火山 running（或仍在 queued 时的累计排队）"
              >
                Queue
              </th>
              <th
                className="w-[88px]"
                title="首次 running → 厂商 updated_at（任务完成）；进行中为实时累计"
              >
                Generate
              </th>
              <th
                className="w-[96px]"
                title="厂商 updated_at → Gateway 检测到成功；应 ≤10s，超出标红"
              >
                Poll Δ
              </th>
              <th className="min-w-[168px]">Submitted</th>
              <th className="min-w-[168px]">Completed</th>
              <th
                className="min-w-[200px]"
                title="Canvas 画布节点 task（CanvasGenerationTask.id）或 Story 任务 id；悬停可看 nodeId"
              >
                Node Task
              </th>
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
              <th
                className="min-w-[200px]"
                title="Gateway 请求日志 id（平台侧 cuid）"
              >
                Log ID
              </th>
              <th
                className="min-w-[200px]"
                title="厂商 HTTP 追踪 Request ID（如 Volcengine 响应头 / 错误体）"
              >
                Request ID
              </th>
              <th
                className="min-w-[200px]"
                title="厂商异步任务 ID（externalTaskId）；提交失败或未创建时为 —"
              >
                Vendor Task ID
              </th>
              <th className="w-[150px]">Results</th>
              <th className="w-[120px]">Retry Callback</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const isInProgress =
                l.status === "RUNNING" || l.status === "PENDING";
              const durationMs = resolveLogDurationMs(
                l.durationMs,
                l.submittedAt,
                l.completedAt,
                isInProgress && liveNowMs != null
                  ? { inProgress: true, nowMs: liveNowMs }
                  : undefined,
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
              const logId = formatLogMonospaceId(l.id);
              const requestId = formatLogMonospaceId(l.vendorRequestId);
              const vendorTaskId = formatLogMonospaceId(l.externalTaskId);
              const appTask = formatLogAppTaskCell(l);
              const queueCell = formatLogTimingPhaseCell(l.queueMs, "queue");
              const generateCell = formatLogTimingPhaseCell(l.generateMs, "generate");
              const pollCell = formatLogTimingPhaseCell(l.pollDelayMs, "poll", {
                overLimit: l.pollDelayOverLimit,
              });
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
                      className="font-mono text-sm text-zinc-300"
                      title={queueCell.title}
                    >
                      {queueCell.value}
                    </span>
                  </td>
                  <td className="align-middle">
                    <span
                      className="font-mono text-sm text-zinc-300"
                      title={generateCell.title}
                    >
                      {generateCell.value}
                    </span>
                  </td>
                  <td className="align-middle">
                    <span
                      className={`font-mono text-sm ${
                        pollCell.warn ? "text-amber-400" : "text-zinc-300"
                      }`}
                      title={pollCell.title}
                    >
                      {pollCell.value}
                    </span>
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
                  <td className="align-middle">
                    <span
                      className="block break-all font-mono text-[11px] leading-snug text-zinc-400"
                      title={appTask.title}
                    >
                      {appTask.value}
                    </span>
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
                      title={logId.title}
                    >
                      {logId.value}
                    </span>
                  </td>
                  <td className="align-middle">
                    <span
                      className="block break-all font-mono text-[11px] leading-snug text-zinc-400"
                      title={requestId.title}
                    >
                      {requestId.value}
                    </span>
                  </td>
                  <td className="align-middle">
                    <span
                      className="block break-all font-mono text-[11px] leading-snug text-zinc-400"
                      title={vendorTaskId.title}
                    >
                      {vendorTaskId.value}
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
            {!logs.length ? (
              <tr>
                <td
                  colSpan={22}
                  className="py-16 text-center text-sm text-zinc-500"
                >
                  {total > 0 ? "本页暂无数据" : "暂无日志"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f14] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">每页</span>
          <select
            value={pageSizePreset}
            onChange={(e) => {
              const next = e.target.value as PageSizePreset;
              setPageSizePreset(next);
              if (next === "custom") return;
              applyPageSize(Number(next));
            }}
            className="rounded-lg border border-white/10 bg-[#141419] px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-white/20"
            aria-label="每页条数"
          >
            {PAGE_SIZE_PRESETS.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
            <option value="custom">自定义</option>
          </select>
          {pageSizePreset === "custom" ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <input
                type="number"
                min={1}
                max={PAGE_SIZE_MAX}
                value={customPageSizeInput}
                onChange={(e) => setCustomPageSizeInput(e.target.value)}
                onBlur={() => {
                  const n = clampPageSize(Number(customPageSizeInput));
                  applyPageSize(n);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const n = clampPageSize(Number(customPageSizeInput));
                  applyPageSize(n);
                }}
                className="w-20 rounded-lg border border-white/10 bg-[#141419] px-2 py-1.5 font-mono text-xs text-zinc-300 outline-none focus:border-white/20"
                aria-label="自定义每页条数"
              />
              条
            </label>
          ) : null}
          <span className="text-[11px] text-zinc-600">
            最多 {PAGE_SIZE_MAX} 条/页
          </span>
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                clearSelectionOnFilter(setSelected);
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一页
            </button>
            <span className="text-xs text-zinc-500">
              第 {page} / {totalPages} 页
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                clearSelectionOnFilter(setSelected);
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        ) : (
          <span className="text-xs text-zinc-600">共 {total} 条</span>
        )}
      </div>
    </div>
  );
}
