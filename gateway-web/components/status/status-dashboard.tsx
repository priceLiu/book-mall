"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GatewayLogRow } from "@/components/logs/logs-table";
import { LogStatusBadge } from "@/components/logs/log-status-badge";
import { GatewayLogPaginationBar } from "@/components/logs/gateway-log-pagination-bar";
import { HorizontalCategoryBars } from "./horizontal-category-bars";
import { StatusExportTable } from "./status-export-table";
import { billingCategoryLabel } from "@/lib/billing-category-labels";
import {
  gatewayFailMessageDisplay,
  resolveGatewayFailCodeDisplay,
} from "@/lib/gateway-log-fail";
import {
  formatDurationSeconds,
  formatLogTimestamp,
  pickLogProgressLabel,
  resolveLogDurationMs,
} from "@/lib/gateway-log-params";
import { displayLogModelKey } from "@/lib/gateway-log-display";
import {
  clampGatewayLogPageSize,
  GATEWAY_LOG_PAGE_SIZE_DEFAULT,
  persistGatewayLogPageSize,
  readStoredGatewayLogPageSize,
  resolveGatewayLogPageSizePreset,
  type GatewayLogPageSizePreset,
} from "@/lib/gateway-log-pagination-config";

const SUMMARY_POLL_IDLE_MS = 60_000;
const SUMMARY_POLL_ACTIVE_MS = 10_000;
const IN_FLIGHT_POLL_MS = 10_000;
const LIVE_CLOCK_MS = 1_000;

type DashboardScope = "all" | "team" | "actor" | "project";
type DetailTab = "succeeded" | "inProgress" | "failed";
type ViewMode = "dashboard" | "table";

type DashboardTeamOption = {
  id: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  canViewAllMembers: boolean;
  isPlatformScope?: boolean;
  ownerHint?: string | null;
};

type DashboardMeta = {
  isPlatformAdmin: boolean;
  bookUserId: string | null;
  currentUser: {
    id: string;
    phone: string | null;
    name: string | null;
    displayLabel: string;
  } | null;
  teams: DashboardTeamOption[];
};

function formatTeamOptionLabel(team: DashboardTeamOption): string {
  if (team.isPlatformScope) {
    const base = team.ownerHint ? `${team.name} · ${team.ownerHint}` : team.name;
    return `${base}（全站）`;
  }
  if (team.role === "OWNER") return `${team.name}（主账号）`;
  if (team.role === "ADMIN") return `${team.name}（管理员）`;
  return `${team.name}（成员）`;
}

type StatusLogRow = GatewayLogRow & {
  billingCategory?: string | null;
  actorPhone?: string | null;
  actorName?: string | null;
  actorDisplayLabel?: string | null;
};

type DashboardStats = {
  cards: {
    inProgress: number;
    succeeded: number;
    failed: number;
    cancelled: number;
  };
  byCategory: {
    inProgress: { category: string; label: string; count: number }[];
    succeeded: { category: string; label: string; count: number }[];
  };
};

type StatsSummaryResponse = {
  cards: DashboardStats["cards"];
};

type StatsCategoriesResponse = {
  byCategory: DashboardStats["byCategory"];
};

type InFlightLogsResponse = {
  logs: StatusLogRow[];
  total: number;
  limit: number;
};

type FilterState = {
  scope: DashboardScope;
  tenantId: string;
  actorPhone: string;
  storyProjectId: string;
  hours: string;
  fromDate: string;
  toDate: string;
};

const HOUR_OPTIONS = [
  { value: "", label: "不限（或选日期）" },
  { value: "1", label: "最近 1 小时" },
  { value: "3", label: "最近 3 小时" },
  { value: "6", label: "最近 6 小时" },
  { value: "12", label: "最近 12 小时" },
];

const TAB_CONFIG: { id: DetailTab; label: string; query: Record<string, string> }[] = [
  { id: "succeeded", label: "成功", query: { status: "SUCCEEDED" } },
  { id: "inProgress", label: "生成中", query: { statuses: "PENDING,RUNNING" } },
  { id: "failed", label: "失败", query: { status: "FAILED" } },
];

function normalizeFilterState(
  state: FilterState,
  teams: DashboardTeamOption[],
): FilterState {
  if (state.scope === "team") {
    const tenantId = state.tenantId || teams[0]?.id || "";
    if (!tenantId) {
      return { ...state, scope: "all", tenantId: "" };
    }
    return { ...state, tenantId };
  }
  if (state.scope === "project" && !state.storyProjectId.trim()) {
    return { ...state, scope: "all" };
  }
  return state;
}

function filtersEqual(a: FilterState, b: FilterState): boolean {
  return (
    a.scope === b.scope &&
    a.tenantId === b.tenantId &&
    a.actorPhone === b.actorPhone &&
    a.storyProjectId === b.storyProjectId &&
    a.hours === b.hours &&
    a.fromDate === b.fromDate &&
    a.toDate === b.toDate
  );
}

function buildQueryString(
  filters: FilterState,
  extra: Record<string, string | number | undefined>,
): string {
  const qs = new URLSearchParams();
  if (filters.scope === "team") {
    if (filters.tenantId) {
      qs.set("scope", "team");
      qs.set("tenantId", filters.tenantId);
    }
  } else if (filters.scope !== "all") {
    qs.set("scope", filters.scope);
  }
  if (
    (filters.scope === "team" || filters.scope === "actor") &&
    filters.actorPhone.trim()
  ) {
    qs.set("actorPhone", filters.actorPhone.trim());
  }
  if (filters.scope === "project" && filters.storyProjectId.trim()) {
    qs.set("storyProjectId", filters.storyProjectId.trim());
  }
  if (filters.hours) {
    qs.set("hours", filters.hours);
  } else {
    if (filters.fromDate) qs.set("from", filters.fromDate);
    if (filters.toDate) qs.set("to", filters.toDate);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

async function fetchJson<T>(
  path: string,
): Promise<
  { ok: true; data: T } | { ok: false; status: number; error?: string }
> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, status: res.status, error: body?.error };
  }
  return { ok: true, data: (await res.json()) as T };
}

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

function LoadingBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-100"
      role="status"
      aria-live="polite"
    >
      <SpinnerIcon className="h-4 w-4 shrink-0 text-sky-300" />
      <span>{message}</span>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-white/10 bg-[var(--gw-surface)] p-4">
      <div className="h-3 w-16 rounded bg-white/10" />
      <div className="mt-3 h-8 w-12 rounded bg-white/10" />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[var(--gw-surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

export function StatusDashboard({ initialMeta }: { initialMeta: DashboardMeta }) {
  const defaultFilters = (): FilterState =>
    normalizeFilterState(
      {
        scope: "all",
        tenantId: initialMeta.teams[0]?.id ?? "",
        actorPhone: "",
        storyProjectId: "",
        hours: "12",
        fromDate: "",
        toDate: "",
      },
      initialMeta.teams,
    );

  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [filters, setFilters] = useState<FilterState>(() => defaultFilters());
  const [applied, setApplied] = useState<FilterState>(() => defaultFilters());
  const [phoneDraft, setPhoneDraft] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("inProgress");
  const [detailPage, setDetailPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(GATEWAY_LOG_PAGE_SIZE_DEFAULT);
  const [pageSizePreset, setPageSizePreset] = useState<GatewayLogPageSizePreset>(
    GATEWAY_LOG_PAGE_SIZE_DEFAULT,
  );
  const [customPageSizeInput, setCustomPageSizeInput] = useState(
    String(GATEWAY_LOG_PAGE_SIZE_DEFAULT),
  );
  const [logs, setLogs] = useState<StatusLogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveNowMs, setLiveNowMs] = useState(0);
  const summaryPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const inProgressCount = stats?.cards.inProgress ?? 0;
  const hasInFlight = inProgressCount > 0 || activeTab === "inProgress";

  const tabQuery = useMemo(
    () => TAB_CONFIG.find((t) => t.id === activeTab)?.query ?? {},
    [activeTab],
  );

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
    setDetailPage(1);
  }, []);

  const commitFilters = useCallback(
    (next: FilterState) => {
      const normalized = normalizeFilterState(next, initialMeta.teams);
      setFilters((prev) => (filtersEqual(prev, normalized) ? prev : normalized));
      setApplied((prev) => (filtersEqual(prev, normalized) ? prev : normalized));
    },
    [initialMeta.teams],
  );

  const loadSummary = useCallback(async () => {
    if (applied.scope === "team" && !applied.tenantId) return null;
    const statsQs = buildQueryString(applied, { parts: "summary" });
    const statsRes = await fetchJson<StatsSummaryResponse>(
      `/api/book-mall/api/gateway/logs/stats?${statsQs}`,
    );
    if (!statsRes.ok) return statsRes;
    setStats((prev) => ({
      cards: statsRes.data.cards,
      byCategory: prev?.byCategory ?? {
        inProgress: [],
        succeeded: [],
      },
    }));
    return statsRes;
  }, [applied]);

  const loadCategories = useCallback(async () => {
    if (applied.scope === "team" && !applied.tenantId) return null;
    const statsQs = buildQueryString(applied, { parts: "categories" });
    const statsRes = await fetchJson<StatsCategoriesResponse>(
      `/api/book-mall/api/gateway/logs/stats?${statsQs}`,
    );
    if (!statsRes.ok) return statsRes;
    setStats((prev) => ({
      cards: prev?.cards ?? {
        inProgress: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
      },
      byCategory: statsRes.data.byCategory,
    }));
    return statsRes;
  }, [applied]);

  const loadDetailLogs = useCallback(
    async (opts?: { skipPoll?: boolean; poll?: boolean }) => {
      if (applied.scope === "team" && !applied.tenantId) return null;

      if (activeTab === "inProgress") {
        const qs = buildQueryString(applied, {
          ...(opts?.poll ? { poll: "1" } : {}),
          ...(opts?.skipPoll ? { skipPoll: "1" } : {}),
        });
        const res = await fetchJson<InFlightLogsResponse>(
          `/api/book-mall/api/gateway/logs/in-flight?${qs}`,
        );
        if (res.ok) {
          setLogs(res.data.logs ?? []);
          setLogsTotal(res.data.total ?? 0);
          setLogsTotalPages(1);
        }
        return res;
      }

      const logsQs = buildQueryString(applied, {
        ...tabQuery,
        page: detailPage,
        limit: pageSize,
        skipPoll: opts?.skipPoll === false ? undefined : "1",
        ...(opts?.poll ? { poll: "1" } : {}),
      });
      const res = await fetchJson<{
        logs: StatusLogRow[];
        total: number;
        totalPages: number;
      }>(`/api/book-mall/api/gateway/logs?${logsQs}`);
      if (res.ok) {
        setLogs(res.data.logs ?? []);
        setLogsTotal(res.data.total ?? 0);
        setLogsTotalPages(res.data.totalPages ?? 1);
      }
      return res;
    },
    [activeTab, applied, detailPage, pageSize, tabQuery],
  );

  const loadAll = useCallback(async () => {
      if (applied.scope === "team" && !applied.tenantId) {
        setError(
          initialMeta.teams.length === 0
            ? "当前账号未加入任何团队"
            : "请选择团队后再查看",
        );
        setLoading(false);
        setDetailLoading(false);
        return;
      }

      const seq = ++loadSeqRef.current;
      setLoading(true);
      setDetailLoading(true);
      setError(null);

      try {
        const [summaryRes, categoriesRes] = await Promise.all([
          loadSummary(),
          loadCategories(),
        ]);
        if (seq !== loadSeqRef.current) return;

        if (summaryRes && !summaryRes.ok) {
          setError(
            summaryRes.status === 401
              ? "登录已失效，请重新登录"
              : summaryRes.error
                ? `${summaryRes.error}（${summaryRes.status}）`
                : `加载统计失败（${summaryRes.status}）`,
          );
          return;
        }
        if (categoriesRes && !categoriesRes.ok) {
          /* 分类图失败不阻塞卡片 */
        }
        hasLoadedOnceRef.current = true;
        setHasLoadedOnce(true);
      } catch {
        if (seq !== loadSeqRef.current) return;
        setError("网络异常，请稍后重试");
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setDetailLoading(false);
        }
      }
  }, [
    applied,
    initialMeta.teams.length,
    loadCategories,
    loadSummary,
  ]);

  useEffect(() => {
    if (viewMode !== "dashboard") return;
    void loadAll();
  }, [loadAll, viewMode]);

  useEffect(() => {
    if (viewMode !== "dashboard") return;
    setDetailLoading(true);
    void loadDetailLogs({ skipPoll: true }).finally(() => setDetailLoading(false));
  }, [activeTab, applied, detailPage, pageSize, loadDetailLogs, viewMode]);

  useEffect(() => {
    setDetailPage(1);
    setDetailLoading(true);
  }, [activeTab, applied, pageSize]);

  useEffect(() => {
    setLiveNowMs(Date.now());
    if (!hasInFlight) return;
    const tick = setInterval(() => setLiveNowMs(Date.now()), LIVE_CLOCK_MS);
    return () => clearInterval(tick);
  }, [hasInFlight]);

  useEffect(() => {
    if (viewMode !== "dashboard") return;
    const ms =
      inProgressCount > 0 ? SUMMARY_POLL_ACTIVE_MS : SUMMARY_POLL_IDLE_MS;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadSummary();
    };
    refresh();
    summaryPollRef.current = setInterval(refresh, ms);
    return () => {
      if (summaryPollRef.current) clearInterval(summaryPollRef.current);
    };
  }, [inProgressCount, loadSummary, viewMode]);

  useEffect(() => {
    if (viewMode !== "dashboard") return;
    if (activeTab !== "inProgress" || inProgressCount <= 0) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadDetailLogs({ poll: true, skipPoll: false });
    };
    refresh();
    inFlightPollRef.current = setInterval(refresh, IN_FLIGHT_POLL_MS);
    return () => {
      if (inFlightPollRef.current) clearInterval(inFlightPollRef.current);
    };
  }, [activeTab, inProgressCount, loadDetailLogs, viewMode]);

  const applyFilters = () => {
    commitFilters({ ...filters, actorPhone: phoneDraft });
  };

  useEffect(() => {
    if (filters.scope !== "team" && filters.scope !== "actor") return;
    if (filters.scope === "team" && !filters.tenantId) return;
    const timer = window.setTimeout(() => {
      commitFilters({ ...filters, actorPhone: phoneDraft });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [phoneDraft, filters.scope, filters.tenantId, commitFilters, filters]);

  const exportQueryString = buildQueryString(applied, {});
  const activeTabLabel =
    TAB_CONFIG.find((t) => t.id === activeTab)?.label ?? "明细";
  const showActorColumns =
    applied.scope === "team" ||
    applied.scope === "actor" ||
    applied.scope === "all";
  const showFailColumns = activeTab === "failed";

  const loadingMessage = hasLoadedOnce
    ? "正在更新数据…"
    : "正在加载驾驶舱数据…";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">状态驾驶舱</h1>
          <p className="mt-1 text-sm text-zinc-500">
            统计卡片按需刷新（无进行中约 60s / 有进行中约 10s）· 仅「生成中」Tab 在有任务时约 10s 增量拉取 · 成功/失败明细按需加载
          </p>
        </div>
        {loading ? (
          <span className="inline-flex items-center gap-2 text-xs text-sky-300/90">
            <SpinnerIcon className="h-3.5 w-3.5" />
            {loadingMessage}
          </span>
        ) : null}
      </div>

      <div className="flex gap-1 rounded-lg border border-white/10 bg-[var(--gw-surface)] p-1 w-fit">
        {(
          [
            { id: "dashboard" as const, label: "驾驶舱" },
            { id: "table" as const, label: "表格" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setViewMode(tab.id)}
            className={`rounded-md px-4 py-2 text-sm ${
              viewMode === tab.id
                ? "bg-sky-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-[var(--gw-surface)] p-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          主体
          <select
            className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            value={filters.scope}
            onChange={(e) => {
              const scope = e.target.value as DashboardScope;
              commitFilters({
                ...filters,
                scope,
                tenantId:
                  scope === "team"
                    ? filters.tenantId || initialMeta.teams[0]?.id || ""
                    : filters.tenantId,
                actorPhone: phoneDraft,
              });
            }}
          >
            <option value="all">全站 / 可见范围</option>
            <option value="team">团队</option>
            <option value="actor">个人</option>
            <option value="project">Story 项目</option>
          </select>
        </label>

        {filters.scope === "team" ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              团队
              <select
                className="min-w-[180px] rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                value={filters.tenantId}
                onChange={(e) =>
                  commitFilters({
                    ...filters,
                    tenantId: e.target.value,
                    actorPhone: phoneDraft,
                  })
                }
              >
                {initialMeta.teams.length === 0 ? (
                  <option value="">无加入的团队</option>
                ) : (
                  initialMeta.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTeamOptionLabel(t)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              成员手机号
              <input
                className="min-w-[160px] rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                placeholder="输入手机号自动筛选"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
              />
            </label>
          </>
        ) : null}

        {filters.scope === "actor" ? (
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            手机号
            <input
              className="min-w-[160px] rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              placeholder={
                initialMeta.currentUser?.phone ??
                initialMeta.currentUser?.displayLabel ??
                "输入手机号"
              }
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
            />
          </label>
        ) : null}

        {filters.scope === "project" ? (
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            storyProjectId
            <input
              className="min-w-[200px] rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              value={filters.storyProjectId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, storyProjectId: e.target.value }))
              }
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          时间
          <select
            className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            value={filters.hours}
            onChange={(e) =>
              setFilters((f) => ({ ...f, hours: e.target.value }))
            }
          >
            {HOUR_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {!filters.hours ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              起（UTC）
              <input
                type="date"
                className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                value={filters.fromDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, fromDate: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              止（UTC）
              <input
                type="date"
                className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                value={filters.toDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, toDate: e.target.value }))
                }
              />
            </label>
          </>
        ) : null}

        <button
          type="button"
          onClick={applyFilters}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          应用筛选
        </button>
        <button
          type="button"
          onClick={() => {
            void loadAll();
            void loadDetailLogs({ poll: true, skipPoll: false });
          }}
          disabled={loading}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          {loading ? "刷新中…" : "立即刷新"}
        </button>
      </div>

      {loading && !hasLoadedOnce ? (
        <LoadingBanner message="正在从 Gateway 拉取统计与明细，请稍候…" />
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {viewMode === "table" ? (
        <StatusExportTable queryString={exportQueryString} />
      ) : null}

      {viewMode === "dashboard" && stats ? (
        <div
          className={`space-y-4 transition-opacity ${
            loading ? "opacity-70" : "opacity-100"
          }`}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="生成中"
              value={stats.cards.inProgress}
              accent="text-amber-300"
            />
            <StatCard
              label="成功"
              value={stats.cards.succeeded}
              accent="text-emerald-400"
            />
            <StatCard
              label="失败"
              value={stats.cards.failed}
              accent="text-red-400"
            />
            <StatCard
              label="已取消"
              value={stats.cards.cancelled}
              accent="text-zinc-400"
              sub="无单独 Tab · 与 Gateway cancelled 一致"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <HorizontalCategoryBars
              title="成功 · 按计费类型"
              rows={stats.byCategory.succeeded.map((r) => ({
                label: r.label,
                count: r.count,
              }))}
            />
            <HorizontalCategoryBars
              title="生成中 · 按计费类型"
              rows={stats.byCategory.inProgress.map((r) => ({
                label: r.label,
                count: r.count,
              }))}
            />
          </div>
        </div>
      ) : viewMode === "dashboard" && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {viewMode === "dashboard" ? (
      <div
        className={`rounded-lg border border-white/10 bg-[var(--gw-surface)] transition-opacity ${
          loading && hasLoadedOnce ? "opacity-80" : "opacity-100"
        }`}
      >
        <div className="flex border-b border-white/10">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={loading && !hasLoadedOnce}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm disabled:cursor-wait disabled:opacity-60 ${
                activeTab === tab.id
                  ? "border-b-2 border-sky-500 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {detailLoading ? (
            <span className="ml-auto inline-flex items-center gap-1.5 self-center pr-4 text-xs text-sky-300/90">
              <SpinnerIcon className="h-3 w-3" />
              正在加载「{activeTabLabel}」明细…
            </span>
          ) : loading && hasLoadedOnce ? (
            <span className="ml-auto inline-flex items-center gap-1.5 self-center pr-4 text-xs text-zinc-500">
              <SpinnerIcon className="h-3 w-3" />
              刷新明细中
            </span>
          ) : null}
        </div>

        <div className="relative overflow-x-auto">
          {detailLoading && logs.length > 0 ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#1a1a22] px-4 py-2 text-sm text-zinc-200">
                <SpinnerIcon className="h-4 w-4 text-sky-400" />
                正在加载「{activeTabLabel}」明细…
              </div>
            </div>
          ) : null}
          <table
            className={`min-w-full text-left text-sm transition-opacity ${
              detailLoading && logs.length > 0 ? "opacity-40" : "opacity-100"
            }`}
          >
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                <th className="px-4 py-3 font-medium">Status</th>
                {showFailColumns ? (
                  <>
                    <th className="px-4 py-3 font-medium">失败码</th>
                    <th className="px-4 py-3 font-medium">失败原因</th>
                  </>
                ) : null}
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">类别</th>
                {showActorColumns ? (
                  <>
                    <th className="px-4 py-3 font-medium">手机号</th>
                    <th className="px-4 py-3 font-medium">昵称</th>
                    <th className="px-4 py-3 font-medium">用户名</th>
                  </>
                ) : null}
                <th className="px-4 py-3 font-medium">耗时</th>
                <th className="px-4 py-3 font-medium">提交时间</th>
                <th className="px-4 py-3 font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {detailLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-zinc-400">
                      <SpinnerIcon className="h-6 w-6 text-sky-400" />
                      <span className="text-sm">
                        正在加载「{activeTabLabel}」明细…
                      </span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-4 py-8 text-center text-zinc-500">
                    当前筛选下暂无记录
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const durationMs = resolveLogDurationMs(
                    log.durationMs,
                    log.submittedAt,
                    log.completedAt,
                    {
                      inProgress:
                        log.status === "PENDING" || log.status === "RUNNING",
                      nowMs: liveNowMs || undefined,
                    },
                  );
                  const progressLabel = pickLogProgressLabel(
                    log.status,
                    log.resultSummary,
                  );
                  const failCode = resolveGatewayFailCodeDisplay({
                    failCode: log.failCode,
                    failMessage: log.failMessage,
                  });
                  const failMessage = gatewayFailMessageDisplay(log.failMessage);
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <LogStatusBadge
                          status={log.status as "PENDING"}
                          failCode={log.failCode}
                          failMessage={log.failMessage}
                          progressLabel={progressLabel}
                        />
                      </td>
                      {showFailColumns ? (
                        <>
                          <td className="px-4 py-3 font-mono text-xs text-red-300">
                            {failCode}
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-xs leading-relaxed text-zinc-400">
                            {failMessage}
                          </td>
                        </>
                      ) : null}
                      <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-zinc-300">
                        {displayLogModelKey(log)}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {billingCategoryLabel(log.billingCategory)}
                      </td>
                      {showActorColumns ? (
                        <>
                          <td className="px-4 py-3 tabular-nums text-zinc-300">
                            {log.actorPhone ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {log.actorName ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {log.actorDisplayLabel ?? "—"}
                          </td>
                        </>
                      ) : null}
                      <td className="px-4 py-3 tabular-nums text-zinc-300">
                        {durationMs != null
                          ? formatDurationSeconds(durationMs)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {formatLogTimestamp(log.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href="/dashboard/logs"
                          title={log.id}
                          className="font-mono text-xs text-sky-400 hover:underline"
                        >
                          {log.id.slice(0, 8)}…
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <GatewayLogPaginationBar
          page={detailPage}
          totalPages={logsTotalPages}
          total={logsTotal}
          rowCount={logs.length}
          pageSize={pageSize}
          pageSizePreset={pageSizePreset}
          customPageSizeInput={customPageSizeInput}
          loading={detailLoading}
          onPageChange={setDetailPage}
          onPageSizePresetChange={setPageSizePreset}
          onCustomPageSizeInputChange={setCustomPageSizeInput}
          onApplyCustomPageSize={applyPageSize}
        />
      </div>
      ) : null}
    </div>
  );
}
