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
  resolveCanvasE2eDisplayMs,
  resolvePreGatewayDisplayMs,
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
  resolveLogVendorPhaseEmptyHint,
  LOG_APP_FILTER_OPTIONS,
} from "@/lib/gateway-log-display";
import {
  hasVolcengineTimingTrace,
  liveVolcengineVideoTiming,
  resolveLiveLogPhaseTiming,
  resolveVendorNativeTimingLive,
} from "@/lib/volcengine-log-timing-live";
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
  peakPollDelayMs?: number | null;
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
  canvasStartedAt?: string | null;
  canvasCompletedAt?: string | null;
  e2eMs?: number | null;
  preGatewayMs?: number | null;
  postGatewayMs?: number | null;
  gatewaySegmentMs?: number | null;
  e2eFrozen?: boolean;
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
  /** 方向 2：画布排队中（待提交）合成行标记 */
  pending?: boolean;
  /** 方向 2：合成行对应的真实画布任务 id（用于与真实日志去重） */
  canvasTaskId?: string | null;
};

/** 后端 canvas-queue?rows=1 返回的合成「排队中」行（已对齐 GatewayLogRow 必填字段） */
type CanvasPendingLogRow = GatewayLogRow & {
  pending: true;
  canvasTaskId: string;
};

function isPendingLogRow(l: GatewayLogRow): boolean {
  return l.pending === true || l.id.startsWith("pending:");
}

const STATUS_OPTIONS = [
  { value: "", label: "Select Status" },
  { value: "RUNNING", label: "running" },
  { value: "PENDING", label: "pending" },
  { value: "SUCCEEDED", label: "success" },
  { value: "FAILED", label: "failed" },
  { value: "CANCELLED", label: "cancelled" },
];

const PAGE_SIZE_PRESETS = [20, 50, 100] as const;
/** 首屏 / 每批懒加载默认条数：先出 50 条，向下滚动再按批加载，避免一次拿太多卡顿。 */
const DEFAULT_PAGE_SIZE = 50;
/** A·自动复核：同一在途行两次自动向厂商复核的最小间隔，避免每秒重复打 recover */
const AUTO_RECOVER_MIN_GAP_MS = 60_000;
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
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
  try {
    const raw = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= PAGE_SIZE_MAX) return Math.floor(n);
  } catch {
    /* ignore */
  }
  return DEFAULT_PAGE_SIZE;
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
  if (!Number.isFinite(value) || value < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(PAGE_SIZE_MAX, Math.floor(value));
}

type LogsViewMode = "live" | "history";
/** 进行中 Duration / 各阶段墙钟刷新间隔 */
const LIVE_CLOCK_MS = 1_000;
/** 自动刷新连续失败达到此次数后才显示红字（瞬时网络闪断静默重试） */
const AUTO_REFRESH_FAIL_BEFORE_ERROR = 3;
/** 避免连接池排队时浏览器挂 60s+；超时后快速失败并允许重试 */
const GATEWAY_LOGS_FETCH_TIMEOUT_MS = 20_000;
const GATEWAY_LOGS_FETCH_MAX_ATTEMPTS = 2;

async function gatewayLogsFetchText(
  path: string,
  opts?: { maxAttempts?: number },
): Promise<{ ok: boolean; status: number; raw: string }> {
  const maxAttempts = opts?.maxAttempts ?? GATEWAY_LOGS_FETCH_MAX_ATTEMPTS;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      GATEWAY_LOGS_FETCH_TIMEOUT_MS,
    );
    try {
      const res = await fetch(path, { signal: controller.signal });
      const raw = await res.text();
      window.clearTimeout(timeoutId);
      if (
        !res.ok &&
        attempt < maxAttempts - 1 &&
        isGatewayTransientFetchError(res.status, raw)
      ) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      return { ok: res.ok, status: res.status, raw };
    } catch (e) {
      window.clearTimeout(timeoutId);
      lastError = e;
      if (
        attempt < maxAttempts - 1 &&
        e instanceof Error &&
        (e.name === "AbortError" || /failed to fetch/i.test(e.message))
      ) {
        await sleepMs(gatewayTransientRetryDelayMs(attempt));
        continue;
      }
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("加载超时，请稍后重试");
      }
      throw e;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error("加载失败，请稍后重试");
}

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

/**
 * 非阻塞骨架：加载时保留表格结构 + 脉冲占位行，避免整表清空后只剩大转圈的「卡住」观感。
 * 顶部一条细进度提示，下面铺若干占位行；查询在后台进行，页面始终可交互。
 */
function LogsListSkeletonRows({
  message,
  rows = 8,
}: {
  message: string;
  rows?: number;
}) {
  return (
    <>
      <tr>
        <td colSpan={30} className="px-3 py-2">
          <span
            className="inline-flex items-center gap-2 text-xs text-[var(--gw-accent)]/90"
            role="status"
            aria-live="polite"
          >
            <SpinnerIcon className="size-3.5 animate-spin" />
            {message}
          </span>
        </td>
      </tr>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`sk-${i}`} className="gw-logs-row" aria-hidden>
          <td colSpan={30} className="py-3">
            <span
              className="block h-3 animate-pulse rounded bg-white/5"
              style={{ width: `${88 - (i % 4) * 12}%` }}
            />
          </td>
        </tr>
      ))}
    </>
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
  const { ok, status, raw } = await gatewayLogsFetchText(path);
  let data: (GatewayLogsResponse & { error?: string }) | null = null;
  try {
    data = raw ? (JSON.parse(raw) as GatewayLogsResponse & { error?: string }) : null;
  } catch {
    data = null;
  }
  if (!ok) {
    throw new Error(
      status === 401
        ? "登录已过期，请重新登录"
        : data?.error === "DATABASE_UNAVAILABLE"
          ? "加载失败，请稍后重试"
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
  try {
    const { ok, raw } = await gatewayLogsFetchText(path, { maxAttempts: 1 });
    if (!ok) return null;
    const data = raw ? (JSON.parse(raw) as { facets?: GatewayLogFacets }) : null;
    return data?.facets ?? null;
  } catch {
    return null;
  }
}

type CanvasQueueFetchResult = {
  stats: CanvasQueueWithoutLogStats | null;
  pendingRows: CanvasPendingLogRow[];
};

async function fetchCanvasQueueStats(): Promise<CanvasQueueFetchResult> {
  try {
    const res = await fetch(
      "/api/book-mall/api/gateway/logs/canvas-queue?staleMin=2&rows=1&limit=50",
    );
    if (!res.ok) return { stats: null, pendingRows: [] };
    const data = (await res.json().catch(() => null)) as
      | (CanvasQueueWithoutLogStats & { pendingRows?: CanvasPendingLogRow[] })
      | null;
    if (!data) return { stats: null, pendingRows: [] };
    const { pendingRows, ...stats } = data;
    return {
      stats: stats as CanvasQueueWithoutLogStats,
      pendingRows: Array.isArray(pendingRows) ? pendingRows : [],
    };
  } catch {
    return { stats: null, pendingRows: [] };
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
  const { ok, status, raw } = await gatewayLogsFetchText(path);
  let data: (GatewayLogsDelta & { error?: string }) | null = null;
  try {
    data = raw ? (JSON.parse(raw) as GatewayLogsDelta & { error?: string }) : null;
  } catch {
    data = null;
  }
  if (!ok) {
    throw new Error(
      status === 401
        ? "登录已过期，请重新登录"
        : data?.error === "DATABASE_UNAVAILABLE"
          ? "加载失败，请稍后重试"
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
  onRecover,
  recovering,
}: {
  log: GatewayLogRow;
  isSelected: boolean;
  /** 仅进行中行传入墙钟 tick；已完成行不传，避免每秒整表重渲染 */
  liveTick?: number | null;
  onToggleSelect: (id: string) => void;
  /** A·主动复核：向厂商核对并收口（进行中且有 taskId 的火山视频行可用） */
  onRecover?: (id: string) => void;
  recovering?: boolean;
}) {
  const isInProgress = isLogInProgress(l.status);
  // 方向 2：排队中（待提交）合成行 —— 尚未到厂商，网关段/厂商分阶段一律 —，
  // 出队前 = 总耗时（点击至今的墙钟），Submitted 显示 —。
  const pendingRow = isPendingLogRow(l);
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
  // B：厂商停更 / 轮询失联 → 生成/网关段已冻结，标黄提示「待核对」（配合主动复核）
  const pollStalled = live.stalled === true && isInProgress;
  const stalledTitleSuffix = pollStalled
    ? "\n⚠ 厂商停更 / 轮询失联超 2min，已冻结生成秒表（多为厂商已返回但未 poll 到）；点击行尾「核对厂商」可立即向厂商复核收口。"
    : "";
  const durationMs = pendingRow
    ? null
    : resolveLogDisplayDurationMs({
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
  const e2eMs = resolveCanvasE2eDisplayMs({
    e2eMs: l.e2eMs,
    canvasStartedAt: l.canvasStartedAt,
    canvasCompletedAt: l.canvasCompletedAt,
    preGatewayMs: l.preGatewayMs,
    submittedAt: l.submittedAt,
    e2eFrozen: l.e2eFrozen,
    isInProgress,
    nowMs: liveTick ?? null,
  });
  const preGatewayMs = pendingRow
    ? (e2eMs ?? null)
    : resolvePreGatewayDisplayMs({
        preGatewayMs: l.preGatewayMs,
        canvasStartedAt: l.canvasStartedAt,
        submittedAt: l.submittedAt,
        isInProgress,
        nowMs: liveTick ?? null,
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
  const e2eDuration = formatDurationSeconds(e2eMs ?? null);
  const preGatewayDuration = formatDurationSeconds(preGatewayMs ?? null);
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
  const generateCell = formatLogTimingPhaseCell(generateMs, "generate", {
    pending: isInProgress && generateMs == null && queueMs != null,
  });
  const postProcCell = formatLogTimingPhaseCell(
    vendorPostProcessMs,
    "postproc",
  );
  const pollCell = formatLogTimingPhaseCell(pollDelayMs, "poll", {
    inProgress: isInProgress,
    overLimit: l.pollDelayOverLimit === true,
    stallCause: l.pollStallDiagnostic?.cause ?? null,
    stallHint: l.pollStallDiagnostic?.hint ?? null,
    peakPollDelayMs: l.peakPollDelayMs,
  });
  const vendorPhaseEmptyHint = resolveLogVendorPhaseEmptyHint({
    providerKind: l.providerKind,
    requestKind: l.requestKind,
    externalTaskId: l.externalTaskId,
    isInProgress,
    hasVolcengineTrace: hasVolcengineTimingTrace(l.resultSummary),
  });
  const phaseCellTitle = (
    cell: { value: string; title?: string },
    fallback?: string,
  ) =>
    cell.value === "—" && fallback
      ? fallback
      : cell.title ?? (cell.value === "—" ? fallback : undefined);
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
        {pendingRow ? (
          <span
            className="block text-center text-xs text-[var(--gw-muted)]"
            title="排队中（待提交）· 尚无可操作日志"
          >
            —
          </span>
        ) : (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(l.id)}
            className="gw-accent-control h-3.5 w-3.5 rounded border-white/20 bg-transparent"
            aria-label={`选择 ${l.id}`}
          />
        )}
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
        {!pendingRow &&
        isInProgress &&
        l.externalTaskId?.trim() &&
        l.providerKind === "VOLCENGINE" &&
        l.requestKind === "VIDEO" &&
        onRecover ? (
          <button
            type="button"
            onClick={() => onRecover(l.id)}
            disabled={recovering}
            className={`mt-1 block rounded px-1.5 py-0.5 text-[10px] leading-none transition-colors disabled:opacity-50 ${
              pollStalled
                ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                : "bg-white/5 text-[var(--gw-muted)] hover:bg-white/10"
            }`}
            title="向厂商复核该任务：若已生成完成则立即收口并停止计数（也会同步画布显示）"
          >
            {recovering ? "核对中…" : "核对厂商"}
          </button>
        ) : null}
      </td>
      <td
        className="align-middle border-l border-white/5 font-mono text-sm font-semibold text-violet-200"
        title={
          e2eMs != null
            ? [
                `真实墙钟：画布点击 → 任务完成（终态冻结，进行中递增）`,
                preGatewayMs != null
                  ? `出队前 ${Math.round(preGatewayMs / 1000)}s`
                  : null,
                l.gatewaySegmentMs != null
                  ? `Gateway ${Math.round(l.gatewaySegmentMs / 1000)}s`
                  : null,
                l.postGatewayMs != null
                  ? `OSS/回写 ${Math.round(l.postGatewayMs / 1000)}s`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "无关联画布任务"
        }
      >
        {e2eDuration}
      </td>
      <td
        className="align-middle font-mono text-sm text-amber-200/90"
        title="我们：点击 → Gateway 有 log（交通控流 QUEUED/DISPATCHING/dispatch/createTask）。超 120s 多为出队卡死。"
      >
        {preGatewayDuration}
      </td>
      <td
        className={`align-middle font-mono text-sm ${
          pollStalled ? "text-amber-400" : "text-[var(--gw-ink)]"
        }`}
        title={
          (durationMs != null && durationMs > 0
            ? queueMs == null &&
                generateMs == null &&
                vendorPostProcessMs == null &&
                (pollDelayMs ?? 0) === 0 &&
                isInProgress
              ? `${durationMs} ms · 尚无厂商分阶段，网关段暂用墙钟（见总耗时）`
              : `${durationMs} ms`
            : isInProgress
              ? progressLabel
                ? `任务进行中 · ${progressLabel}`
                : vendorPhaseEmptyHint ?? "任务进行中"
              : durationMs != null
                ? `${durationMs} ms（由完成时间推算）`
                : "") + stalledTitleSuffix || undefined
        }
      >
        {duration}
      </td>
      <td className="align-middle border-r border-white/5">
        <span
          className={`font-mono text-sm ${
            pollCell.warn ? "text-amber-400" : "text-[var(--gw-ink)]"
          }`}
          title={phaseCellTitle(pollCell, vendorPhaseEmptyHint)}
        >
          {pollCell.value}
        </span>
      </td>
      <td className="align-middle border-l border-white/5">
        <span
          className="font-mono text-sm text-[var(--gw-ink)]"
          title={phaseCellTitle(queueCell, vendorPhaseEmptyHint)}
        >
          {queueCell.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className={`font-mono text-sm ${
            pollStalled ? "text-amber-400" : "text-[var(--gw-ink)]"
          }`}
          title={
            (phaseCellTitle(generateCell, vendorPhaseEmptyHint) ?? "") +
              stalledTitleSuffix || undefined
          }
        >
          {generateCell.value}
        </span>
      </td>
      <td className="align-middle">
        <span
          className="font-mono text-sm text-[var(--gw-ink)]"
          title={phaseCellTitle(postProcCell, vendorPhaseEmptyHint)}
        >
          {postProcCell.value}
        </span>
      </td>
      <td
        className="align-middle font-mono text-sm text-[var(--gw-muted)]"
        title={
          vendorNative.vendorNativeDurationMs != null
            ? `厂商原生 ${vendorNative.vendorNativeDurationMs} ms（只读，不回写）`
            : vendorPhaseEmptyHint ?? "厂商未回传可对比总耗时"
        }
      >
        {vendorNativeDuration}
      </td>
      <td className="align-middle border-r border-white/5">
        <span
          className="font-mono text-sm text-[var(--gw-muted)]"
          title={
            vendorNative.vendorNativeGenerateMs != null
              ? `厂商原生 ${vendorNative.vendorNativeGenerateMs} ms（只读，不回写）`
              : vendorPhaseEmptyHint ?? "厂商未回传可对比生成耗时"
          }
        >
          {vendorNativeGenerate}
        </span>
      </td>
      <td className="align-middle">
        {pendingRow ? (
          <span
            className="text-sm text-[var(--gw-muted)]"
            title="尚未提交厂商（排队 / 派发中）"
          >
            —
          </span>
        ) : (
          <span
            className="block whitespace-nowrap font-mono text-[11px] leading-snug text-[var(--gw-muted)]"
            title={l.submittedAt}
          >
            {formatLogTimestamp(l.submittedAt)}
          </span>
        )}
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
  const [pageSize, setPageSize] = useState(initialData.pageSize || DEFAULT_PAGE_SIZE);
  const [pageSizePreset, setPageSizePreset] = useState<PageSizePreset>(
    resolvePageSizePreset(initialData.pageSize || DEFAULT_PAGE_SIZE),
  );
  const [customPageSizeInput, setCustomPageSizeInput] = useState(
    String(initialData.pageSize || DEFAULT_PAGE_SIZE),
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
  const [listReady, setListReady] = useState(initialData.logs.length > 0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [canvasQueueStats, setCanvasQueueStats] = useState(
    initialData.canvasQueueStats ?? null,
  );
  /** 方向 2：画布排队中（待提交）合成行，点击生成后第一时间在 Logs 出现 */
  const [pendingRows, setPendingRows] = useState<CanvasPendingLogRow[]>([]);
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
  const autoRefreshFailStreakRef = useRef(0);

  const reportFetchError = useCallback(
    (message: string, opts?: { silent?: boolean }) => {
      if (opts?.silent) {
        autoRefreshFailStreakRef.current += 1;
        if (autoRefreshFailStreakRef.current >= AUTO_REFRESH_FAIL_BEFORE_ERROR) {
          setFetchError(message);
        }
        return;
      }
      autoRefreshFailStreakRef.current = 0;
      setFetchError(message);
    },
    [],
  );

  const clearFetchErrorOnSuccess = useCallback(() => {
    autoRefreshFailStreakRef.current = 0;
    setFetchError(null);
  }, []);

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

  /**
   * 方向 2：仅在 live 模式 + 无筛选时，把画布「排队中（待提交）」合成行并入列表顶部。
   * 任务一旦提交厂商即转 RUNNING（不再被排队查询命中），且这里再按真实日志的
   * storyTaskId / appTaskId 去重一次，避免与刚出现的真实日志短暂双出。
   */
  const showPendingRows = viewMode === "live" && filtersAreDefault;
  const displayLogs = useMemo(() => {
    if (!showPendingRows || pendingRows.length === 0) return logs;
    const realTaskIds = new Set<string>();
    for (const l of logs) {
      const sid = l.storyTaskId?.trim();
      if (sid) realTaskIds.add(sid);
      const aid = l.appTaskId?.trim();
      if (aid) realTaskIds.add(aid);
    }
    const visiblePending = pendingRows.filter(
      (p) => !realTaskIds.has(p.canvasTaskId),
    );
    if (visiblePending.length === 0) return logs;
    return [...visiblePending, ...logs];
  }, [logs, pendingRows, showPendingRows]);

  const hasInFlightLogs = useMemo(
    () =>
      displayLogs.some((l) => isLogInProgress(l.status) || isPendingLogRow(l)),
    [displayLogs],
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
      /** 自动刷新 tick：连续失败达阈值前不弹红字 */
      silent?: boolean;
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
        clearFetchErrorOnSuccess();
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
          reportFetchError(
            e instanceof Error ? e.message : "加载日志失败",
            { silent: opts?.silent },
          );
        }
        return null;
      }
    },
    [listFilterParams, clearFetchErrorOnSuccess, reportFetchError],
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
    async (opts?: { poll?: boolean; silent?: boolean }) => {
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
      clearFetchErrorOnSuccess();
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
          if (s.stats) setCanvasQueueStats(s.stats);
          setPendingRows(s.pendingRows);
        });
        setLastRefreshedAt(new Date());
        return null;
      } catch (e) {
        reportFetchError(
          e instanceof Error ? e.message : "加载日志失败",
          { silent: opts?.silent },
        );
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
      clearFetchErrorOnSuccess,
      reportFetchError,
    ],
  );

  useEffect(() => {
    setLogs(initialData.logs);
    if (initialData.pageSize) {
      setPageSize(initialData.pageSize);
    }
    if (initialData.facets) setFacets(initialData.facets);
  }, [initialData]);

  useEffect(() => {
    const stored = readStoredPageSize();
    if (stored === pageSize) return;
    setPageSize(stored);
    setPageSizePreset(resolvePageSizePreset(stored));
    setCustomPageSizeInput(String(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时恢复 localStorage 每页条数
  }, []);

  /** 动数据自动刷新：首屏加载完成后再启动，避免与首屏请求叠加打满 DB */
  useEffect(() => {
    if (!autoRefresh || viewMode !== "live" || !listReady) return;

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
          await loadLogsDelta({ poll: true, silent: true });
        } else if (loadedPagesRef.current === 1) {
          await loadLogsPaged({ poll: true, includeFacets: false, silent: true });
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
  }, [autoRefresh, viewMode, listReady, loadLogsPaged, loadLogsDelta, shouldLiveFastRefresh]);

  /** 筛选 / 每页条数 / 动静切换：重置并拉首屏（skipCount） */
  useEffect(() => {
    if (dateRangeInvalid) return;

    if (skipInitialFetchRef.current && viewMode === "live") {
      skipInitialFetchRef.current = false;
      if (
        initialData.logs.length > 0 &&
        filtersAreDefault &&
        pageSize === (initialData.pageSize || DEFAULT_PAGE_SIZE)
      ) {
        setLoading(false);
        setListReady(true);
        return;
      }
    }

    resetListScroll();
    setLoading(true);
    setListReady(false);
    setFetchError(null);
    autoRefreshFailStreakRef.current = 0;
    clearSelectionOnFilter(setSelected);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await loadLogsPaged({
            includeFacets: false,
          });
        } finally {
          if (!cancelled) {
            setLoading(false);
            setListReady(true);
          }
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

  /** 实时 Tab：分面单独拉取；首屏列表就绪后再请求，避免并发占满连接池 */
  useEffect(() => {
    if (dateRangeInvalid || viewMode !== "live" || !listReady) return;
    const timer = window.setTimeout(() => void loadFacets(), 800);
    return () => window.clearTimeout(timer);
  }, [dateRangeInvalid, viewMode, listReady, loadFacets]);

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

  // A·主动复核：向厂商核对该任务，命中终态即收口（停止计数）；完成后轻量增量刷新
  const [recoveringIds, setRecoveringIds] = useState<Set<string>>(new Set());
  const recoverAttemptRef = useRef<Map<string, number>>(new Map());
  const recoverLog = useCallback(
    async (logId: string) => {
      setRecoveringIds((prev) => new Set(prev).add(logId));
      try {
        await fetch(`/api/book-mall/api/gateway/logs/${logId}/recover`, {
          method: "POST",
        });
      } catch {
        /* 静默：失败留待下次轮询 / 手动重试 */
      } finally {
        setRecoveringIds((prev) => {
          const next = new Set(prev);
          next.delete(logId);
          return next;
        });
        void loadLogsDelta({ silent: true });
      }
    },
    [loadLogsDelta],
  );

  // A·自动兜底：live 模式下，对「厂商停更 / 轮询失联」且已有 taskId 的在途火山视频行，
  // 每行节流 60s 自动向厂商复核一次（命中即收口、停止计数），把检测滞后从分钟级压到秒级。
  useEffect(() => {
    if (viewMode !== "live" || liveNowMs == null) return;
    const now = liveNowMs;
    for (const l of displayLogs) {
      if (isPendingLogRow(l)) continue;
      if (!isLogInProgress(l.status)) continue;
      if (!l.externalTaskId?.trim()) continue;
      if (l.providerKind !== "VOLCENGINE" || l.requestKind !== "VIDEO") continue;
      const volc = liveVolcengineVideoTiming({
        submittedAt: l.submittedAt,
        completedAt: l.completedAt,
        resultSummary: l.resultSummary,
        nowMs: now,
      });
      if (!volc?.stalled) continue;
      const last = recoverAttemptRef.current.get(l.id) ?? 0;
      if (now - last < AUTO_RECOVER_MIN_GAP_MS) continue;
      recoverAttemptRef.current.set(l.id, now);
      void recoverLog(l.id);
    }
  }, [displayLogs, liveNowMs, viewMode, recoverLog]);

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
            <tr className="border-b border-white/10">
              <th rowSpan={2} className="w-11 align-bottom">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="gw-accent-control h-3.5 w-3.5 rounded border-white/20 bg-transparent"
                  aria-label="全选"
                />
              </th>
              <th rowSpan={2} className="min-w-[120px] align-bottom" title="发起请求的用户手机号">
                Phone
              </th>
              <th rowSpan={2} className="min-w-[100px] align-bottom" title="用户昵称">
                Nick
              </th>
              <th rowSpan={2} className="w-[88px] align-bottom">
                Source
              </th>
              <th rowSpan={2} className="min-w-[168px] align-bottom">
                Model
              </th>
              <th
                rowSpan={2}
                className="min-w-[140px] align-bottom"
                title="实际路由的厂商凭证 Key（脱敏）"
              >
                Key
              </th>
              <th rowSpan={2} className="min-w-[480px] align-bottom">
                Params
              </th>
              <th rowSpan={2} className="min-w-[280px] align-bottom">
                Images
              </th>
              <th
                rowSpan={2}
                className="min-w-[220px] align-bottom"
                title="任务状态；失败行展示 failCode 与 failMessage"
              >
                Status
              </th>
              <th
                colSpan={4}
                className="border-x border-white/10 bg-sky-950/35 px-2 py-1.5 text-center text-[11px] font-semibold tracking-wide text-sky-200/95"
              >
                系统
              </th>
              <th
                colSpan={5}
                className="border-x border-white/10 bg-zinc-800/45 px-2 py-1.5 text-center text-[11px] font-semibold tracking-wide text-zinc-300/95"
              >
                厂商
              </th>
              <th rowSpan={2} className="min-w-[168px] align-bottom">
                Submitted
              </th>
              <th rowSpan={2} className="min-w-[168px] align-bottom">
                Completed
              </th>
              <th
                rowSpan={2}
                className="min-w-[200px] align-bottom"
                title="Canvas 画布节点 task（CanvasGenerationTask.id）或 Story 任务 id；悬停可看 nodeId"
              >
                Node Task
              </th>
              <th
                rowSpan={2}
                className="min-w-[160px] align-bottom"
                title="挂牌参考费用（元），供后续费用统计；非钱包扣点。"
              >
                Usage ¥
              </th>
              <th
                rowSpan={2}
                className="w-[96px] align-bottom"
                title="平台代付扣减积分（Finance 2.0 · 与 finance-web 扣减明细一致）"
              >
                Credits
              </th>
              <th
                rowSpan={2}
                className="w-[110px] align-bottom"
                title="Token 计量：厂商回传优先；异步任务按 prompt 文本平台估算。"
              >
                Token
              </th>
              <th
                rowSpan={2}
                className="min-w-[200px] align-bottom"
                title="Gateway 请求日志 id（平台侧 cuid）"
              >
                Log ID
              </th>
              <th
                rowSpan={2}
                className="min-w-[200px] align-bottom"
                title="厂商 HTTP 追踪 Request ID（如 Volcengine 响应头 / 错误体）"
              >
                Request ID
              </th>
              <th
                rowSpan={2}
                className="min-w-[200px] align-bottom"
                title="厂商异步任务 ID（externalTaskId）；提交失败或未创建时为 —"
              >
                Vendor Task ID
              </th>
              <th rowSpan={2} className="w-[150px] align-bottom">
                Results
              </th>
              <th rowSpan={2} className="w-[120px] align-bottom">
                Retry Callback
              </th>
            </tr>
            <tr className="border-b border-white/10 text-[11px]">
              <th
                className="whitespace-nowrap border-l border-white/10 bg-sky-950/20 px-2 text-violet-200"
                title="真实墙钟：画布点击 → 任务完成。唯一与用户体感一致的总计时；终态冻结，进行中 live 递增。"
              >
                总耗时
              </th>
              <th
                className="whitespace-nowrap bg-sky-950/20 px-2 text-amber-200/90"
                title="我们 · 出队前：点击 → Gateway submitted（控流/dispatch/DB，此阶段无 Gateway log）。"
              >
                出队前
              </th>
              <th
                className="whitespace-nowrap bg-sky-950/20 px-2"
                title="Gateway 段：各阶段之和（排队+生成+后处理+轮询）；进行中按阶段墙钟实时累计。点击→完成的总墙钟见左列「总耗时」。"
              >
                网关段
              </th>
              <th
                className="whitespace-nowrap border-r border-white/10 bg-sky-950/20 px-2"
                title="我方轮询滞后：距上次成功 poll 的间隔；黄字表示超过阈值。"
              >
                轮询
              </th>
              <th
                className="whitespace-nowrap border-l border-white/10 bg-zinc-800/25 px-2"
                title="仅火山异步视频 · Gateway 提交 → 首次观测到火山 running（或仍在 queued 时的累计排队）"
              >
                排队
              </th>
              <th
                className="whitespace-nowrap bg-zinc-800/25 px-2"
                title="仅火山异步视频 · 生成阶段秒表：到厂商起按墙钟实时累计，厂商完成时冻结；厂商 GPU 真值见右侧「厂商生成」列。"
              >
                生成
              </th>
              <th
                className="whitespace-nowrap bg-zinc-800/25 px-2"
                title="仅火山异步视频 · 成功任务：updated_at 跳变 → 首次 succeeded；失败为 —"
              >
                后处理
              </th>
              <th
                className="whitespace-nowrap bg-zinc-800/25 px-2 text-[var(--gw-muted)]"
                title="仅火山异步视频 · 厂商原生总耗时；生图/无 trace 为 —"
              >
                总耗时
              </th>
              <th
                className="whitespace-nowrap border-r border-white/10 bg-zinc-800/25 px-2 text-[var(--gw-muted)]"
                title="仅火山异步视频 · 厂商 GPU 真值（updated−created，只读）；与左侧「生成」墙钟对照。未跳变前不计秒。"
              >
                厂商生成
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LogsListSkeletonRows
                message={
                  viewMode === "history"
                    ? "正在后台查询历史归档，页面可继续操作…"
                    : "正在加载日志…"
                }
              />
            ) : (
              <>
            {displayLogs.map((l) => (
              <LogsTableRow
                key={l.id}
                log={l}
                isSelected={selected.has(l.id)}
                liveTick={
                  isLogInProgress(l.status) || isPendingLogRow(l)
                    ? liveNowMs
                    : undefined
                }
                onToggleSelect={toggleOne}
                onRecover={recoverLog}
                recovering={recoveringIds.has(l.id)}
              />
            ))}
            {!displayLogs.length ? (
              <tr>
                <td
                  colSpan={30}
                  className="py-16 text-center text-sm text-[var(--gw-muted)]"
                >
                  {loading ? (
                    "加载中…"
                  ) : fetchError ? (
                    <span className="inline-flex flex-col items-center gap-3">
                      <span>{fetchError}</span>
                      <button
                        type="button"
                        className="gw-btn-secondary text-xs"
                        onClick={() => void refreshLogs()}
                        disabled={refreshing}
                      >
                        {refreshing ? "重试中…" : "重试"}
                      </button>
                    </span>
                  ) : (
                    "暂无日志"
                  )}
                </td>
              </tr>
            ) : null}
            {loadingMore ? (
              <tr>
                <td
                  colSpan={30}
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
