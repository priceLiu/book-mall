"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
  isLogInProgress,
  pickLogProgressLabel,
  resolveLogDisplayDurationMs,
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
import { resolveLiveLogPhaseTiming, resolveVendorNativeTimingLive } from "@/lib/volcengine-log-timing-live";
import { useLiveWallClockMs } from "@/lib/use-live-wall-clock";
import {
  gatewayLivePollIntervalMs,
  GATEWAY_LIVE_HOT_SYNC_MS,
  type GatewayDynamicActivityCounts,
} from "@/lib/gateway-live-poll-policy";
import {
  gatewayTransientRetryDelayMs,
  isGatewayTransientFetchError,
  sleepMs,
} from "@/lib/gateway-db-retry";
import {
  filterLiveHotWindowRows,
  gatewayLogHotCutoffMs,
} from "@/lib/gateway-log-hot-window";

export type GatewayLogRow = {
  id: string;
  model: string;
  canonicalModelKey?: string | null;
  displayModelKey?: string | null;
  tenantId?: string | null;
  actorBookUserId?: string | null;
  actorPhone?: string | null;
  actorName?: string | null;
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
  vendorPostProcessMs?: number | null;
  pollDelayMs?: number | null;
  pollDelayOverLimit?: boolean;
  pollStallDiagnostic?: {
    cause?: string;
    hint?: string;
    pollLagSec?: number;
    selectedThisTick?: boolean;
    slowRunningTotal?: number;
    batchLimit?: number;
  } | null;
  vendorNativeDurationMs?: number | null;
  vendorNativeGenerateMs?: number | null;
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
const FILTERS_COLLAPSED_STORAGE_KEY = "gw-logs-filters-collapsed";
const PAGE_SIZE_MAX = 500;
/** 历史模式单次无限滚动上限（与状态看板一致） */
const INFINITE_SCROLL_MAX_ROWS = 500;

type PageSizePreset = (typeof PAGE_SIZE_PRESETS)[number] | "custom";

type GatewayLogFacets = {
  models: string[];
  providerKinds: string[];
  credentialKeys: { id: string; masked: string }[];
};

type CanvasQueueWithoutLogStats = {
  total: number;
  queued: number;
  dispatching: number;
  staleCount: number;
  staleMinutes: number;
  fetchedAt: string;
};

type GatewayLogsResponse = {
  logs: GatewayLogRow[];
  total: number | null;
  page: number;
  pageSize: number;
  totalPages: number | null;
  hasMore?: boolean;
  facets?: GatewayLogFacets;
  canvasQueueStats?: CanvasQueueWithoutLogStats | null;
  hotCutoffMs?: number | null;
};

export type GatewayLogsInitialData = {
  logs: GatewayLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: GatewayLogFacets;
  canvasQueueStats?: CanvasQueueWithoutLogStats | null;
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

function readFiltersCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FILTERS_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFiltersCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(FILTERS_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
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

type LogsViewMode = "live" | "history";
/** 进行中 Duration / 各阶段墙钟刷新间隔 */
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

function LogsListLoadingRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={24} className="py-20 text-center">
        <SpinnerIcon className="mx-auto size-6 animate-spin text-[var(--gw-accent)]/90" />
        <p className="mt-3 text-sm text-[var(--gw-muted)]" role="status" aria-live="polite">
          {message}
        </p>
      </td>
    </tr>
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

function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: expanded ? "rotate(180deg)" : undefined }}
    >
      <path
        d="M6 9l6 6 6-6"
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
  mode: LogsViewMode;
  skipPoll?: boolean;
  poll?: boolean;
  /** 自动刷新 tick 传 false：不重算分面，沿用上一次 facets，降低 DB 压力 */
  includeFacets?: boolean;
  /** 仅拉筛选项分面（不查日志行） */
  facetsOnly?: boolean;
  /** 历史追加页：跳过 count，响应带 hasMore */
  skipCount?: boolean;
}): Promise<GatewayLogsResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.pageSize),
    mode: params.mode,
  });
  if (params.skipCount) qs.set("skipCount", "1");
  if (params.fromDate) qs.set("from", params.fromDate);
  if (params.toDate) qs.set("to", params.toDate);
  if (params.statusFilter) qs.set("status", params.statusFilter);
  if (params.sourceFilter) qs.set("clientSource", params.sourceFilter);
  if (params.providerFilter) qs.set("providerKind", params.providerFilter);
  if (params.modelFilter) qs.set("model", params.modelFilter);
  if (params.credentialIdFilter) qs.set("credentialId", params.credentialIdFilter);
  if (params.mode === "history") qs.set("skipPoll", "1");
  else if (params.skipPoll !== false) qs.set("skipPoll", "1");
  if (params.poll) qs.set("poll", "1");
  if (params.includeFacets === false) qs.set("facets", "0");
  if (params.facetsOnly) qs.set("facets", "only");
  const path = `/api/book-mall/api/gateway/logs?${qs.toString()}`;
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(path);
      const raw = await res.text();
      let data: (GatewayLogsResponse & { error?: string }) | null = null;
      try {
        data = raw ? (JSON.parse(raw) as GatewayLogsResponse & { error?: string }) : null;
      } catch {
        data = null;
      }
      if (
        !res.ok &&
        attempt < maxAttempts - 1 &&
        isGatewayTransientFetchError(res.status, raw)
      ) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      if (!res.ok) {
        throw new Error(
          data?.error === "DATABASE_UNAVAILABLE"
            ? "服务繁忙，请稍后再试"
            : (data?.error ?? "加载日志失败"),
        );
      }
      return {
        logs: data?.logs ?? [],
        total: data?.total ?? null,
        page: data?.page ?? params.page,
        pageSize: data?.pageSize ?? params.pageSize,
        totalPages: data?.totalPages ?? null,
        hasMore: data?.hasMore,
        facets: data?.facets,
        canvasQueueStats: data?.canvasQueueStats ?? null,
        hotCutoffMs: data?.hotCutoffMs,
      };
    } catch (e) {
      if (
        attempt < maxAttempts - 1 &&
        e instanceof Error &&
        (e.name === "AbortError" || /failed to fetch/i.test(e.message))
      ) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      if (e instanceof Error && e.message !== "加载日志失败") {
        throw new Error(
          e.name === "AbortError" || /failed to fetch/i.test(e.message)
            ? "暂时无法连接主站，请稍后再试"
            : e.message,
        );
      }
      throw e;
    }
  }

  throw new Error("服务繁忙，请稍后再试");
}

/** 仅拉筛选项分面（动静分离：与日志行查询解耦，加快首屏/Tab 切换） */
async function fetchGatewayLogFacets(params: {
  pageSize: number;
  fromDate: string;
  toDate: string;
  statusFilter: string;
  sourceFilter: string;
  providerFilter: string;
  modelFilter: string;
  credentialIdFilter: string;
  mode: LogsViewMode;
}): Promise<GatewayLogFacets | null> {
  const qs = new URLSearchParams({
    page: "1",
    limit: String(params.pageSize),
    mode: params.mode,
    facets: "only",
    skipCount: "1",
    skipPoll: "1",
  });
  if (params.fromDate) qs.set("from", params.fromDate);
  if (params.toDate) qs.set("to", params.toDate);
  if (params.statusFilter) qs.set("status", params.statusFilter);
  if (params.sourceFilter) qs.set("clientSource", params.sourceFilter);
  if (params.providerFilter) qs.set("providerKind", params.providerFilter);
  if (params.modelFilter) qs.set("model", params.modelFilter);
  if (params.credentialIdFilter) qs.set("credentialId", params.credentialIdFilter);
  const path = `/api/book-mall/api/gateway/logs?${qs.toString()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(path);
      const raw = await res.text();
      if (
        !res.ok &&
        attempt < 2 &&
        isGatewayTransientFetchError(res.status, raw)
      ) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      if (!res.ok) return null;
      const data = raw
        ? (JSON.parse(raw) as { facets?: GatewayLogFacets })
        : null;
      return data?.facets ?? null;
    } catch {
      if (attempt < 2) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function fetchCanvasQueueStats(): Promise<CanvasQueueWithoutLogStats | null> {
  try {
    const res = await fetch("/api/book-mall/api/gateway/logs/canvas-queue?staleMin=2");
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as CanvasQueueWithoutLogStats | null;
  } catch {
    return null;
  }
}

type GatewayLogsDelta = {
  created: GatewayLogRow[];
  updated: GatewayLogRow[];
  serverNowMs: number;
  sinceApplied: string | null;
  hotCutoffMs?: number;
};

/** 增量拉取：自上次游标起的新行 + 在途行最新状态（不算 count / facets / 全量行） */
async function fetchGatewayLogsDelta(params: {
  since: string;
  ids: string[];
  fromDate: string;
  toDate: string;
  statusFilter: string;
  sourceFilter: string;
  providerFilter: string;
  modelFilter: string;
  credentialIdFilter: string;
  poll?: boolean;
}): Promise<GatewayLogsDelta> {
  const qs = new URLSearchParams({ mode: "live" });
  qs.set("since", params.since);
  if (params.ids.length) qs.set("ids", params.ids.join(","));
  if (params.fromDate) qs.set("from", params.fromDate);
  if (params.toDate) qs.set("to", params.toDate);
  if (params.statusFilter) qs.set("status", params.statusFilter);
  if (params.sourceFilter) qs.set("clientSource", params.sourceFilter);
  if (params.providerFilter) qs.set("providerKind", params.providerFilter);
  if (params.modelFilter) qs.set("model", params.modelFilter);
  if (params.credentialIdFilter) qs.set("credentialId", params.credentialIdFilter);
  if (params.poll) qs.set("poll", "1");
  else qs.set("skipPoll", "1");
  const path = `/api/book-mall/api/gateway/logs/delta?${qs.toString()}`;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(path);
      const raw = await res.text();
      let data: (GatewayLogsDelta & { error?: string }) | null = null;
      try {
        data = raw ? (JSON.parse(raw) as GatewayLogsDelta & { error?: string }) : null;
      } catch {
        data = null;
      }
      if (
        !res.ok &&
        attempt < maxAttempts - 1 &&
        isGatewayTransientFetchError(res.status, raw)
      ) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      if (!res.ok) {
        throw new Error(
          data?.error === "DATABASE_UNAVAILABLE"
            ? "服务繁忙，请稍后再试"
            : (data?.error ?? "加载日志失败"),
        );
      }
      return {
        created: data?.created ?? [],
        updated: data?.updated ?? [],
        serverNowMs: data?.serverNowMs ?? Date.now(),
        sinceApplied: data?.sinceApplied ?? null,
        hotCutoffMs: data?.hotCutoffMs,
      };
    } catch (e) {
      if (
        attempt < maxAttempts - 1 &&
        e instanceof Error &&
        (e.name === "AbortError" || /failed to fetch/i.test(e.message))
      ) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      if (e instanceof Error && e.message !== "加载日志失败") {
        throw new Error(
          e.name === "AbortError" || /failed to fetch/i.test(e.message)
            ? "暂时无法连接主站，请稍后再试"
            : e.message,
        );
      }
      throw e;
    }
  }

  throw new Error("服务繁忙，请稍后再试");
}

/** 升序游标合并：updated 原地替换、created 去重前插，按 submittedAt desc 排序并截断 */
function mergeLogsDelta(
  prev: GatewayLogRow[],
  delta: GatewayLogsDelta,
): { rows: GatewayLogRow[]; addedCount: number; removedCount: number } {
  const hotCutoffMs = delta.hotCutoffMs ?? gatewayLogHotCutoffMs(delta.serverNowMs);
  const map = new Map(prev.map((r) => [r.id, r]));
  for (const u of delta.updated) {
    if (map.has(u.id)) map.set(u.id, u);
  }
  let addedCount = 0;
  for (const c of delta.created) {
    if (!map.has(c.id)) addedCount += 1;
    map.set(c.id, c);
  }
  const merged = [...map.values()].sort((a, b) => {
    if (a.submittedAt === b.submittedAt) return a.id < b.id ? 1 : -1;
    return a.submittedAt < b.submittedAt ? 1 : -1;
  });
  const liveRows = filterLiveHotWindowRows(merged, hotCutoffMs);
  const removedCount = merged.length - liveRows.length;
  const capped = liveRows.slice(0, INFINITE_SCROLL_MAX_ROWS);
  return { rows: capped, addedCount, removedCount };
}

function logFilterChipClass(active: boolean): string {
  return active ? "gw-chip-active" : "gw-chip";
}

function clearSelectionOnFilter(setSelected: (s: Set<string>) => void) {
  setSelected(new Set());
}

const LogsTableRow = memo(function LogsTableRow({
  log: l,
  isSelected,
  liveTick,
  onToggleSelect,
}: {
  log: GatewayLogRow;
  isSelected: boolean;
  /** 仅进行中行传入墙钟 tick；已完成行不传，避免每秒整表重渲染 */
  liveTick?: number | null;
  onToggleSelect: (id: string) => void;
}) {
  const isInProgress = isLogInProgress(l.status);
  const live = resolveLiveLogPhaseTiming({
    submittedAt: l.submittedAt,
    completedAt: l.completedAt,
    status: l.status,
    resultSummary: l.resultSummary,
    nowMs: liveTick ?? null,
    server: {
      queueMs: l.queueMs,
      generateMs: l.generateMs,
      vendorPostProcessMs: l.vendorPostProcessMs,
      pollDelayMs: l.pollDelayMs,
    },
  });
  const queueMs = live.queueMs;
  const generateMs = live.generateMs;
  const vendorPostProcessMs = live.vendorPostProcessMs;
  const pollDelayMs = live.pollDelayMs;
  const durationMs = resolveLogDisplayDurationMs({
    durationMs: l.durationMs,
    submittedAt: l.submittedAt,
    completedAt: l.completedAt,
    isInProgress,
    nowMs: liveTick ?? null,
    queueMs,
    generateMs,
    vendorPostProcessMs,
    pollDelayMs,
    liveTotalMs: live.totalMs,
  });
  const vendorNative = resolveVendorNativeTimingLive({
    providerKind: l.providerKind,
    requestKind: l.requestKind,
    vendorDurationMs: l.vendorDurationMs,
    resultSummary: l.resultSummary,
    nowMs: liveTick ?? Date.now(),
    server: {
      vendorNativeDurationMs: l.vendorNativeDurationMs,
      vendorNativeGenerateMs: l.vendorNativeGenerateMs,
    },
  });
  const duration = formatDurationSeconds(durationMs);
  const vendorNativeDuration = formatDurationSeconds(
    vendorNative.vendorNativeDurationMs,
  );
  const vendorNativeGenerate = formatDurationSeconds(
    vendorNative.vendorNativeGenerateMs,
  );
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
  const queueCell = formatLogTimingPhaseCell(queueMs, "queue");
  const generateCell = formatLogTimingPhaseCell(generateMs, "generate");
  const postProcCell = formatLogTimingPhaseCell(
    vendorPostProcessMs,
    "postproc",
  );
  const pollCell = formatLogTimingPhaseCell(pollDelayMs, "poll", {
    inProgress: isInProgress,
    overLimit: l.pollDelayOverLimit === true,
    stallCause: l.pollStallDiagnostic?.cause ?? null,
    stallHint: l.pollStallDiagnostic?.hint ?? null,
  });
  const rawProgressLabel = isInProgress
    ? pickLogProgressLabel(l.status, l.resultSummary)
    : null;
  const statusShort = l.status.trim().toLowerCase();
  const progressLabel =
    rawProgressLabel &&
    rawProgressLabel.trim().toLowerCase() !== statusShort
      ? rawProgressLabel
      : null;
  const sourceLabel = formatLogPageLabel(l.clientSource, l.clientPage);
  const sourceTitle = formatLogSourceTooltip(
    l.clientSource,
    l.providerKind,
    l.clientPage,
  );

  return (
    <tr className="gw-logs-row">
      <td className="align-middle">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(l.id)}
          className="gw-accent-control h-3.5 w-3.5 rounded border-white/20 bg-transparent"
          aria-label={`选择 ${l.id}`}
        />
      </td>
      <td className="align-middle tabular-nums text-sm text-[var(--gw-ink)]">
        {l.actorPhone?.trim() || "—"}
      </td>
      <td className="align-middle text-sm text-[var(--gw-ink)]">
        {l.actorName?.trim() || "—"}
      </td>
      <td className="align-middle">
        <span className="text-sm text-[var(--gw-ink)]" title={sourceTitle}>
          {sourceLabel}
        </span>
      </td>
      <td className="align-top">
        <span
          className="gw-btn-xs font-mono"
          title={displayLogModelKey(l) !== l.model ? l.model : undefined}
        >
          {displayLogModelKey(l)}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="font-mono text-[11px] text-[var(--gw-muted)]"
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
        className="align-middle text-center text-xs text-[var(--gw-muted)]"
        title="汇总见表头；单行日志与画布排队无直接对应"
      >
        —
      </td>
      <td
        className="align-middle font-mono text-sm text-[var(--gw-ink)]"
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
      <td
        className="align-middle font-mono text-sm text-[var(--gw-muted)]"
        title={
          vendorNative.vendorNativeDurationMs != null
            ? `厂商原生 ${vendorNative.vendorNativeDurationMs} ms（只读，不回写）`
            : "厂商未回传可对比总耗时"
        }
      >
        {vendorNativeDuration}
      </td>
      <td className="align-middle">
        <span
          className="font-mono text-sm text-[var(--gw-ink)]"
          title={queueCell.title}
        >
          {queueCell.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="font-mono text-sm text-[var(--gw-ink)]"
          title={generateCell.title}
        >
          {generateCell.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="font-mono text-sm text-[var(--gw-muted)]"
          title={
            vendorNative.vendorNativeGenerateMs != null
              ? `厂商原生 ${vendorNative.vendorNativeGenerateMs} ms（只读，不回写）`
              : "厂商未回传可对比生成耗时"
          }
        >
          {vendorNativeGenerate}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="font-mono text-sm text-[var(--gw-ink)]"
          title={postProcCell.title}
        >
          {postProcCell.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className={`font-mono text-sm ${
            pollCell.warn ? "text-amber-400" : "text-[var(--gw-ink)]"
          }`}
          title={pollCell.title}
        >
          {pollCell.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="block whitespace-nowrap font-mono text-[11px] leading-snug text-[var(--gw-muted)]"
          title={l.submittedAt}
        >
          {formatLogTimestamp(l.submittedAt)}
        </span>
      </td>
      <td className="align-middle">
        {l.completedAt ? (
          <span
            className="block whitespace-nowrap font-mono text-[11px] leading-snug text-[var(--gw-muted)]"
            title={l.completedAt}
          >
            {formatLogTimestamp(l.completedAt)}
          </span>
        ) : (
          <span
            className="text-sm text-[var(--gw-muted)]"
            title={isInProgress ? "任务进行中" : undefined}
          >
            —
          </span>
        )}
      </td>
      <td className="align-middle">
        <span
          className="block break-all font-mono text-[11px] leading-snug text-[var(--gw-muted)]"
          title={appTask.title}
        >
          {appTask.value}
        </span>
      </td>
      <td
        className="align-middle font-mono text-sm text-[var(--gw-ink)]"
        title={isInProgress ? "任务进行中，完成后写入费用估算" : usage.title}
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
        className="align-middle font-mono text-sm text-[var(--gw-ink)]"
        title={
          isInProgress ? "任务进行中，完成后写入 Token" : tokens.title
        }
      >
        {isInProgress ? "—" : tokens.value}
      </td>
      <td className="align-middle">
        <span
          className="block break-all font-mono text-[11px] leading-snug text-[var(--gw-muted)]"
          title={logId.title}
        >
          {logId.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="block break-all font-mono text-[11px] leading-snug text-[var(--gw-muted)]"
          title={requestId.title}
        >
          {requestId.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="block break-all font-mono text-[11px] leading-snug text-[var(--gw-muted)]"
          title={vendorTaskId.title}
        >
          {vendorTaskId.value}
        </span>
      </td>
      <td className="align-middle">
        <LogResultCell status={l.status} resultSummary={l.resultSummary} />
      </td>
      <td className="align-middle text-center text-[var(--gw-muted)]">—</td>
    </tr>
  );
});

export function LogsTable({ initialData }: { initialData: GatewayLogsInitialData }) {
  const [logs, setLogs] = useState(initialData.logs);
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
  const [loading, setLoading] = useState(initialData.logs.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [canvasQueueStats, setCanvasQueueStats] = useState(
    initialData.canvasQueueStats ?? null,
  );
  const [viewMode, setViewMode] = useState<LogsViewMode>("live");
  const viewModeRef = useRef<LogsViewMode>("live");
  viewModeRef.current = viewMode;
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedPages, setLoadedPages] = useState(1);
  const loadedPagesRef = useRef(1);
  const hasMoreLogsRef = useRef(true);
  const historyLoadSeqRef = useRef(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  loadedPagesRef.current = loadedPages;
  hasMoreLogsRef.current = hasMoreLogs;
  const [pageVisible, setPageVisible] = useState(true);
  const pageVisibleRef = useRef(true);
  pageVisibleRef.current = pageVisible;
  const autoRefreshBusyRef = useRef(false);

  useEffect(() => {
    const onVis = () => {
      const visible = document.visibilityState === "visible";
      setPageVisible(visible);
      pageVisibleRef.current = visible;
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    setFiltersCollapsed(readFiltersCollapsed());
  }, []);

  const dateRangeInvalid = isLogDateRangeInvalid(fromDate, toDate);

  const skipInitialFetchRef = useRef(true);

  const listFilterParams = useMemo(
    () => ({
      pageSize,
      fromDate,
      toDate,
      statusFilter,
      sourceFilter,
      providerFilter,
      modelFilter,
      credentialIdFilter,
      mode: viewMode,
    }),
    [
      pageSize,
      fromDate,
      toDate,
      statusFilter,
      sourceFilter,
      providerFilter,
      modelFilter,
      credentialIdFilter,
      viewMode,
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
    () => logs.some((l) => isLogInProgress(l.status)),
    [logs],
  );
  /** 每秒 tick，仅在有在飞任务时启用，避免已完成行每秒整表重渲染 */
  const liveNowMs = useLiveWallClockMs(LIVE_CLOCK_MS, hasInFlightLogs);
  const hasInFlightLogsRef = useRef(hasInFlightLogs);
  hasInFlightLogsRef.current = hasInFlightLogs;
  const canvasQueueStatsRef = useRef(canvasQueueStats);
  canvasQueueStatsRef.current = canvasQueueStats;

  const hasCanvasQueueActivity = useMemo(
    () => (canvasQueueStats?.total ?? 0) > 0,
    [canvasQueueStats],
  );
  const hasCanvasQueueActivityRef = useRef(hasCanvasQueueActivity);
  hasCanvasQueueActivityRef.current = hasCanvasQueueActivity;

  const shouldLiveFastRefresh = useCallback(() => {
    return (
      hasInFlightLogsRef.current || hasCanvasQueueActivityRef.current
    );
  }, []);

  const logsRef = useRef(logs);
  logsRef.current = logs;
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  const resetListScroll = useCallback(() => {
    setLoadedPages(1);
    loadedPagesRef.current = 1;
    setHasMoreLogs(true);
    hasMoreLogsRef.current = true;
  }, []);

  /** 动/静数据统一：首屏或滚动追加，skipCount 跳过慢 count */
  const loadLogsPaged = useCallback(
    async (opts?: {
      append?: boolean;
      poll?: boolean;
      includeFacets?: boolean;
    }) => {
      const append = opts?.append === true;
      if (
        append &&
        (!hasMoreLogsRef.current ||
          logsRef.current.length >= INFINITE_SCROLL_MAX_ROWS)
      ) {
        return null;
      }

      const targetPage = append ? loadedPagesRef.current + 1 : 1;
      const seq = ++historyLoadSeqRef.current;

      try {
        setFetchError(null);
        const data = await fetchGatewayLogs({
          ...listFilterParams,
          page: targetPage,
          skipPoll: !opts?.poll,
          poll: opts?.poll,
          includeFacets: append ? false : opts?.includeFacets,
          skipCount: true,
        });
        if (seq !== historyLoadSeqRef.current) return null;

        let batch = data.logs;
        if (listFilterParams.mode === "live") {
          const hotCutoffMs = data.hotCutoffMs ?? gatewayLogHotCutoffMs();
          batch = filterLiveHotWindowRows(batch, hotCutoffMs);
        }

        const pageHasMore =
          data.hasMore ?? batch.length === listFilterParams.pageSize;

        if (append) {
          setLogs((prev) => {
            const seen = new Set(prev.map((l) => l.id));
            const merged = [...prev];
            for (const row of batch) {
              if (!seen.has(row.id)) merged.push(row);
            }
            const capped = merged.slice(0, INFINITE_SCROLL_MAX_ROWS);
            setHasMoreLogs(
              pageHasMore && capped.length < INFINITE_SCROLL_MAX_ROWS,
            );
            return capped;
          });
        } else {
          setLogs(batch.slice(0, INFINITE_SCROLL_MAX_ROWS));
          setHasMoreLogs(
            pageHasMore && batch.length < INFINITE_SCROLL_MAX_ROWS,
          );
          if (data.facets) setFacets(data.facets);
          if (data.canvasQueueStats) setCanvasQueueStats(data.canvasQueueStats);
        }

        setLoadedPages(targetPage);
        loadedPagesRef.current = targetPage;
        setLastRefreshedAt(new Date());
        return data;
      } catch (e) {
        if (seq === historyLoadSeqRef.current) {
          setFetchError(e instanceof Error ? e.message : "加载日志失败");
        }
        return null;
      }
    },
    [listFilterParams],
  );

  const loadFacets = useCallback(async () => {
    if (viewModeRef.current !== "live") return;
    const facets = await fetchGatewayLogFacets(listFilterParams);
    if (facets) setFacets(facets);
  }, [listFilterParams]);

  const refreshLogs = useCallback(async () => {
    setRefreshing(true);
    try {
      resetListScroll();
      return await loadLogsPaged({ poll: true, includeFacets: false });
    } finally {
      setRefreshing(false);
    }
  }, [loadLogsPaged, resetListScroll]);

  /** 动数据增量刷新：只拉新行 + 在途行最新状态，客户端合并 */
  const loadLogsDelta = useCallback(
    async (opts?: { poll?: boolean }) => {
      const current = logsRef.current;
      if (current.length === 0) {
        return loadLogsPaged({ poll: opts?.poll, includeFacets: false });
      }
      let cursor = current[0]?.submittedAt ?? "";
      for (const r of current) {
        if (r.submittedAt > cursor) cursor = r.submittedAt;
      }
      if (!cursor) {
        return loadLogsPaged({ poll: opts?.poll, includeFacets: false });
      }
      const inFlightIds = current
        .filter((l) => isLogInProgress(l.status))
        .map((l) => l.id);
      setFetchError(null);
      try {
        const delta = await fetchGatewayLogsDelta({
          since: cursor,
          ids: inFlightIds,
          fromDate,
          toDate,
          statusFilter,
          sourceFilter,
          providerFilter,
          modelFilter,
          credentialIdFilter,
          poll: opts?.poll,
        });
        const merged = mergeLogsDelta(logsRef.current, delta);
        setLogs(merged.rows);
        void fetchCanvasQueueStats().then((s) => {
          if (s) setCanvasQueueStats(s);
        });
        setLastRefreshedAt(new Date());
        return null;
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "加载日志失败");
        return null;
      }
    },
    [
      loadLogsPaged,
      fromDate,
      toDate,
      statusFilter,
      sourceFilter,
      providerFilter,
      modelFilter,
      credentialIdFilter,
    ],
  );

  useEffect(() => {
    setLogs(initialData.logs);
    setPageSize(initialData.pageSize || PAGE_SIZE_PRESETS[0]);
    if (initialData.facets) setFacets(initialData.facets);
  }, [initialData]);

  useEffect(() => {
    const stored = readStoredPageSize();
    if (stored !== initialData.pageSize) {
      setPageSize(stored);
      setPageSizePreset(resolvePageSizePreset(stored));
      setCustomPageSizeInput(String(stored));
      resetListScroll();
      skipInitialFetchRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时恢复每页条数
  }, []);

  /** 动数据自动刷新：有在飞走 delta；仅首屏时同步热区，已滚动加载则跳过全量 */
  useEffect(() => {
    if (!autoRefresh || viewMode !== "live") return;

    let cancelled = false;
    let timer: number | undefined;

    const schedule = (delayMs: number) => {
      if (cancelled || delayMs <= 0) return;
      timer = window.setTimeout(() => void run(), delayMs);
    };

    const run = async () => {
      if (cancelled || viewModeRef.current !== "live") return;
      if (!pageVisibleRef.current) {
        schedule(GATEWAY_LIVE_HOT_SYNC_MS);
        return;
      }
      if (autoRefreshBusyRef.current) {
        schedule(3000);
        return;
      }
      autoRefreshBusyRef.current = true;
      try {
        const fast = shouldLiveFastRefresh();
        if (fast) {
          await loadLogsDelta({ poll: true });
        } else if (loadedPagesRef.current === 1) {
          await loadLogsPaged({ poll: true, includeFacets: false });
        }
      } finally {
        autoRefreshBusyRef.current = false;
      }
      if (cancelled) return;
      const intervalMs = shouldLiveFastRefresh()
        ? gatewayLivePollIntervalMs(
            { inProgress: 0, slowWarn: 0, backgroundWait: 0 },
            true,
          )
        : GATEWAY_LIVE_HOT_SYNC_MS;
      schedule(intervalMs);
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [autoRefresh, viewMode, loadLogsPaged, loadLogsDelta, shouldLiveFastRefresh]);

  /** 筛选 / 每页条数 / 动静切换：重置并拉首屏（skipCount） */
  useEffect(() => {
    if (dateRangeInvalid) return;

    if (skipInitialFetchRef.current && viewMode === "live") {
      skipInitialFetchRef.current = false;
      if (
        initialData.logs.length > 0 &&
        filtersAreDefault &&
        pageSize === (initialData.pageSize || PAGE_SIZE_PRESETS[0])
      ) {
        setLoading(false);
        return;
      }
    }

    resetListScroll();
    setLoading(true);
    setFetchError(null);
    clearSelectionOnFilter(setSelected);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await loadLogsPaged({
            includeFacets: false,
          });
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    listFilterParams,
    dateRangeInvalid,
    filtersAreDefault,
    initialData.pageSize,
    pageSize,
    viewMode,
    loadLogsPaged,
    resetListScroll,
  ]);

  /** 实时 Tab：分面单独拉取，不阻塞日志列表首屏 */
  useEffect(() => {
    if (dateRangeInvalid || viewMode !== "live") return;
    const timer = window.setTimeout(() => void loadFacets(), 300);
    return () => window.clearTimeout(timer);
  }, [dateRangeInvalid, viewMode, loadFacets]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loading || loadingMore || !hasMoreLogsRef.current) return;
        if (logsRef.current.length >= INFINITE_SCROLL_MAX_ROWS) return;
        setLoadingMore(true);
        void loadLogsPaged({ append: true }).finally(() =>
          setLoadingMore(false),
        );
      },
      { rootMargin: "320px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMoreLogs, logs.length, loadLogsPaged]);


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

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (sourceFilter) {
      const opt = LOG_APP_FILTER_OPTIONS.find((o) => o.value === sourceFilter);
      labels.push(`应用: ${opt?.label ?? sourceFilter}`);
    }
    if (fromDate || toDate) {
      labels.push(
        fromDate && toDate
          ? `日期: ${fromDate} ~ ${toDate}`
          : fromDate
            ? `从 ${fromDate}`
            : `至 ${toDate}`,
      );
    }
    if (statusFilter) {
      const opt = STATUS_OPTIONS.find((o) => o.value === statusFilter);
      labels.push(`状态: ${opt?.label ?? statusFilter}`);
    }
    if (providerFilter) {
      labels.push(`厂商: ${formatProviderKindLabel(providerFilter)}`);
    }
    if (modelFilter) labels.push(`模型: ${modelFilter}`);
    if (credentialIdFilter) {
      const cred = credentialKeyOptions.find((c) => c.id === credentialIdFilter);
      labels.push(
        `Key: ${cred ? formatLogCredentialKeyMasked(cred.masked) : credentialIdFilter}`,
      );
    }
    return labels;
  }, [
    sourceFilter,
    fromDate,
    toDate,
    statusFilter,
    providerFilter,
    modelFilter,
    credentialIdFilter,
    credentialKeyOptions,
  ]);

  const toggleFiltersCollapsed = () => {
    setFiltersCollapsed((prev) => {
      const next = !prev;
      writeFiltersCollapsed(next);
      return next;
    });
  };

  const resetListScrollOnFilter = () => resetListScroll();

  const switchViewMode = (mode: LogsViewMode) => {
    if (mode === viewMode) return;
    setLoading(true);
    setFetchError(null);
    setViewMode(mode);
    resetListScrollOnFilter();
    clearSelectionOnFilter(setSelected);
  };

  const applyPageSize = (next: number) => {
    const clamped = clampPageSize(next);
    setPageSize(clamped);
    setPageSizePreset(resolvePageSizePreset(clamped));
    setCustomPageSizeInput(String(clamped));
    resetListScroll();
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

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 space-y-2.5 rounded-xl border border-[var(--gw-border)] bg-[#0f0f14] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="mr-1 shrink-0 text-xs text-[var(--gw-muted)]">视图</span>
            <button
              type="button"
              className={logFilterChipClass(viewMode === "live")}
              disabled={loading && viewMode !== "live"}
              onClick={() => switchViewMode("live")}
            >
              实时（近 1h）
            </button>
            <button
              type="button"
              className={logFilterChipClass(viewMode === "history")}
              disabled={loading && viewMode !== "history"}
              onClick={() => switchViewMode("history")}
            >
              历史
            </button>
            <span className="mx-1 text-zinc-700">|</span>
            <span className="mr-1 shrink-0 text-xs text-[var(--gw-muted)]">应用</span>
            {LOG_APP_FILTER_OPTIONS.map((opt) => {
              const active = sourceFilter === opt.value;
              return (
                <button
                  key={opt.value || "all"}
                  type="button"
                  className={logFilterChipClass(active)}
                  onClick={() => {
                    setSourceFilter(opt.value);
                    resetListScrollOnFilter();
                    clearSelectionOnFilter(setSelected);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            <span className="ml-2 shrink-0 text-[11px] text-[var(--gw-muted)]">
              {loading
                ? "加载中…"
                : `已加载 ${logs.length} 条${loadedPages > 1 ? ` · 已翻 ${loadedPages} 页` : ""}`}
              {(fromDate || toDate) && !loading ? " · 按日期" : ""}
              {viewMode === "live"
                ? autoRefresh && hasInFlightLogs
                  ? " · 自动刷新 · 轮询厂商"
                  : autoRefresh
                    ? " · 自动刷新（无在飞已暂停）"
                    : ""
                : " · 历史（不自动刷新）"}
              {lastRefreshedAt && !loading
                ? ` · 更新 ${lastRefreshedAt.toLocaleTimeString()}`
                : ""}
              {canvasQueueStats && canvasQueueStats.total > 0 ? (
                <span
                  className="ml-1 text-violet-300/95"
                  title="交通控流排队中的画布视频任务，createTask 成功前不会产生 Gateway 日志"
                >
                  · 画布排队（尚无 log）{" "}
                  <span className="font-medium text-violet-200">
                    {canvasQueueStats.total}
                  </span>
                  {canvasQueueStats.staleCount > 0
                    ? ` · ≥${canvasQueueStats.staleMinutes}min ${canvasQueueStats.staleCount}`
                    : ""}
                </span>
              ) : null}
            </span>
            <Link
              href="/dashboard/poll-pool"
              className="shrink-0 text-[11px] text-[var(--gw-accent)]/90 underline-offset-2 hover:text-[var(--gw-accent)] hover:underline"
            >
              轮询池
            </Link>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {fetchError ? (
              <span className="text-xs text-red-400/90">{fetchError}</span>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--gw-border)] px-2.5 py-2 text-[11px] text-[var(--gw-muted)] transition hover:border-white/20 hover:text-[var(--gw-ink)]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="gw-accent-control h-3.5 w-3.5 rounded border-white/20 bg-transparent"
              />
              自动刷新
            </label>
            <button
              type="button"
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--gw-border)] px-2.5 py-2 text-[11px] text-[var(--gw-muted)] transition hover:border-white/20 hover:bg-[var(--gw-hover)] hover:text-[var(--gw-ink)] disabled:cursor-not-allowed disabled:opacity-50"
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
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--gw-border)] px-2.5 py-2 text-[11px] text-[var(--gw-muted)] transition hover:border-white/20 hover:bg-[var(--gw-hover)] hover:text-[var(--gw-ink)]"
              onClick={toggleFiltersCollapsed}
              aria-expanded={!filtersCollapsed}
              title={filtersCollapsed ? "展开筛选条件" : "收起筛选条件以显示更多列表"}
            >
              <ChevronIcon className="size-3.5 transition-transform" expanded={!filtersCollapsed} />
              {filtersCollapsed ? "展开筛选" : "收起筛选"}
            </button>
          </div>
        </div>

        {filtersCollapsed && !filtersAreDefault ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--gw-border)] pt-2">
            <span className="shrink-0 text-[11px] text-[var(--gw-muted)]">已筛选</span>
            {activeFilterLabels.map((label) => (
              <span
                key={label}
                className="rounded-md border border-sky-500/20 bg-[var(--gw-accent-muted)] px-2 py-0.5 text-[11px] text-[var(--gw-accent)]/90"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}

        {!filtersCollapsed ? (
          <>
            <div className="flex flex-wrap items-end justify-end gap-2 border-t border-[var(--gw-border)] pt-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--gw-muted)]">开始日期</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    resetListScrollOnFilter();
                    clearSelectionOnFilter(setSelected);
                  }}
                  className="w-[148px] rounded-lg border border-[var(--gw-border)] bg-[#141419] px-3 py-2 text-sm text-[var(--gw-ink)] outline-none focus:border-white/20 [color-scheme:dark]"
                  aria-label="开始日期"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--gw-muted)]">结束日期</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    resetListScrollOnFilter();
                    clearSelectionOnFilter(setSelected);
                  }}
                  className="w-[148px] rounded-lg border border-[var(--gw-border)] bg-[#141419] px-3 py-2 text-sm text-[var(--gw-ink)] outline-none focus:border-white/20 [color-scheme:dark]"
                  aria-label="结束日期"
                />
              </label>
              {fromDate || toDate ? (
                <button
                  type="button"
                  className="rounded-lg border border-[var(--gw-border)] px-2.5 py-2 text-xs text-[var(--gw-muted)] transition hover:border-white/20 hover:bg-[var(--gw-hover)] hover:text-[var(--gw-ink)]"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                    resetListScrollOnFilter();
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
                  resetListScrollOnFilter();
                  clearSelectionOnFilter(setSelected);
                }}
                className="min-w-[160px] rounded-lg border border-[var(--gw-border)] bg-[#141419] px-3 py-2 text-sm text-[var(--gw-ink)] outline-none focus:border-white/20"
                aria-label="按状态筛选"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {dateRangeInvalid ? (
                <span className="self-center text-xs text-amber-400/90">
                  结束日期不能早于开始日期
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--gw-border)] pt-2.5">
              <span className="mr-1 shrink-0 text-xs text-[var(--gw-muted)]">厂商</span>
              <button
                type="button"
                className={logFilterChipClass(!providerFilter)}
                onClick={() => {
                  setProviderFilter("");
                  setModelFilter("");
                  setCredentialIdFilter("");
                  resetListScrollOnFilter();
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
                    resetListScrollOnFilter();
                    clearSelectionOnFilter(setSelected);
                  }}
                >
                  {formatProviderKindLabel(kind)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--gw-border)] pt-2.5">
              <span className="shrink-0 text-xs text-[var(--gw-muted)]">模型</span>
              <select
                value={modelFilter}
                onChange={(e) => {
                  setModelFilter(e.target.value);
                  resetListScrollOnFilter();
                  clearSelectionOnFilter(setSelected);
                }}
                disabled={!modelOptions.length}
                className="min-w-[min(100%,320px)] max-w-xl flex-1 rounded-lg border border-[var(--gw-border)] bg-[#141419] px-3 py-2 font-mono text-xs text-[var(--gw-ink)] outline-none focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                <span className="shrink-0 text-[11px] text-[var(--gw-muted)]">
                  已按 {formatProviderKindLabel(providerFilter)} 收窄
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--gw-border)] pt-2.5">
              <span className="shrink-0 text-xs text-[var(--gw-muted)]">渠道 Key</span>
              <select
                value={credentialIdFilter}
                onChange={(e) => {
                  setCredentialIdFilter(e.target.value);
                  resetListScrollOnFilter();
                  clearSelectionOnFilter(setSelected);
                }}
                disabled={!credentialKeyOptions.length}
                className="min-w-[min(100%,280px)] max-w-md flex-1 rounded-lg border border-[var(--gw-border)] bg-[#141419] px-3 py-2 font-mono text-xs text-[var(--gw-ink)] outline-none focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                <span className="shrink-0 text-[11px] text-[var(--gw-muted)]">
                  当前批次无渠道 Key 记录
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <div
        className="gw-logs-table-scroll gw-scrollbar-thin relative min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--gw-border)] bg-[#0f0f14]"
        aria-busy={loading}
      >
        <table className="gw-logs-table min-w-[3356px]">
          <thead>
            <tr>
              <th className="w-11">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="gw-accent-control h-3.5 w-3.5 rounded border-white/20 bg-transparent"
                  aria-label="全选"
                />
              </th>
              <th className="min-w-[120px]" title="发起请求的用户手机号">
                Phone
              </th>
              <th className="min-w-[100px]" title="用户昵称">
                Nick
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
              <th
                className="min-w-[220px]"
                title="任务状态；失败行展示 failCode 与 failMessage"
              >
                Status
              </th>
              <th
                className="w-[96px]"
                title="全站汇总：CanvasGenerationTask 处于 QUEUED/DISPATCHING、尚未 createTask 产生 Gateway 日志的数量（非本行字段）"
              >
                <div>Canvas 排队</div>
                <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-violet-300/90">
                  {canvasQueueStats ? canvasQueueStats.total : "—"}
                </div>
              </th>
              <th
                className="w-[88px]"
                title="Gateway 观测耗时：Submitted → Completed（或进行中为实时计时）。含火山排队与轮询间隔，非厂商控制台内的纯渲染秒数。"
              >
                Duration
              </th>
              <th
                className="w-[72px] text-[var(--gw-muted)]"
                title="厂商原生总耗时（只读）：KIE costTime 或火山 created_at→updated_at；不写回库，可与左侧 Duration 对比。"
              >
                厂商 Dur
              </th>
              <th
                className="w-[88px]"
                title="Gateway 提交 → 首次观测到火山 running（或仍在 queued 时的累计排队）"
              >
                Queue
              </th>
              <th
                className="w-[88px]"
                title="厂商 GPU 生成：进行中为墙钟；成功为 updated_at−created_at；失败为观测到厂商终态前的等待"
              >
                Generate
              </th>
              <th
                className="w-[72px] text-[var(--gw-muted)]"
                title="厂商原生生成耗时（只读）：火山 trace updated_at−created_at 或 KIE costTime；不写回库，可与左侧 Generate 对比。"
              >
                厂商 Gen
              </th>
              <th
                className="w-[96px]"
                title="仅成功任务：updated_at 跳变 → 首次 succeeded 的后处理/打包；失败任务为 —"
              >
                PostProc
              </th>
              <th
                className="w-[88px]"
                title="成功：首次 succeeded → Gateway completed；失败：观测到厂商终态/末次 poll → completed（我方收口延迟）"
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
            {loading ? (
              <LogsListLoadingRow
                message={
                  viewMode === "history"
                    ? "正在查询历史归档，可能需数十秒…"
                    : "正在加载日志…"
                }
              />
            ) : (
              <>
            {logs.map((l) => (
              <LogsTableRow
                key={l.id}
                log={l}
                isSelected={selected.has(l.id)}
                liveTick={
                  isLogInProgress(l.status) ? liveNowMs : undefined
                }
                onToggleSelect={toggleOne}
              />
            ))}
            {!logs.length ? (
              <tr>
                <td
                  colSpan={24}
                  className="py-16 text-center text-sm text-[var(--gw-muted)]"
                >
                  {loading ? "加载中…" : "暂无日志"}
                </td>
              </tr>
            ) : null}
            {loadingMore ? (
              <tr>
                <td
                  colSpan={24}
                  className="py-4 text-center text-xs text-[var(--gw-accent)]/90"
                >
                  正在加载更多…
                </td>
              </tr>
            ) : null}
              </>
            )}
          </tbody>
        </table>
        <div ref={loadMoreSentinelRef} className="h-1" aria-hidden />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--gw-border)] bg-[#0f0f14] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--gw-muted)]">每批</span>
          <select
            value={pageSizePreset}
            onChange={(e) => {
              const next = e.target.value as PageSizePreset;
              setPageSizePreset(next);
              if (next === "custom") return;
              applyPageSize(Number(next));
            }}
            className="rounded-lg border border-[var(--gw-border)] bg-[#141419] px-2.5 py-1.5 text-xs text-[var(--gw-ink)] outline-none focus:border-white/20"
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
            <label className="inline-flex items-center gap-1.5 text-xs text-[var(--gw-muted)]">
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
                className="w-20 rounded-lg border border-[var(--gw-border)] bg-[#141419] px-2 py-1.5 font-mono text-xs text-[var(--gw-ink)] outline-none focus:border-white/20"
                aria-label="自定义每页条数"
              />
              条
            </label>
          ) : null}
          <span className="text-[11px] text-[var(--gw-muted)]">
            最多 {PAGE_SIZE_MAX} 条/页
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--gw-muted)]">
            {loadingMore ? (
              <span className="text-[var(--gw-accent)]/90">正在加载更多…</span>
            ) : hasMoreLogs && logs.length < INFINITE_SCROLL_MAX_ROWS ? (
              <span>
                向下滚动自动加载（每批 {pageSize} 条，单次最多 {INFINITE_SCROLL_MAX_ROWS} 条）
              </span>
            ) : logs.length >= INFINITE_SCROLL_MAX_ROWS ? (
              <span className="text-amber-300/90">
                已达单次加载上限，请缩小时间范围后刷新
              </span>
            ) : (
              <span>已全部加载</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
