"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDurationSeconds } from "@/lib/gateway-log-params";

type PollPoolGatewayRow = {
  id: string;
  status: string;
  providerKind: string | null;
  requestKind: string;
  model: string | null;
  canonicalModelKey: string | null;
  clientSource: string;
  externalTaskId: string | null;
  submittedAt: string;
  lastPolledAt: string | null;
  pollCount: number;
  ageSec: number;
  slowWarn: boolean;
  backgroundWait: boolean;
  gatewayLogId: string;
};

type PollPoolAppTaskRow = {
  id: string;
  app: "canvas" | "story";
  status: string;
  kind: string;
  projectId: string;
  projectName: string;
  nodeId: string | null;
  gatewayLogId: string | null;
  vendorTaskId: string | null;
  submittedAt: string;
  lastPolledAt: string | null;
  pollCount: number;
  ageSec: number;
  slowWarn: boolean;
  backgroundWait: boolean;
};

type PollPoolResponse = {
  serverTime: string;
  config: {
    slowWarnMs: number;
    slowWarnSec: number;
    slowWarnSource?: "platform" | "env";
    backgroundWaitMs: number;
    backgroundWaitSec: number;
    gatewayPollLimit: number;
    canvasPollBatch: number;
  };
  gateway: {
    total: number;
    slowCount: number;
    backgroundCount: number;
    queue: PollPoolGatewayRow[];
  };
  canvas: {
    totalSubmitted: number;
    totalPending: number;
    slowCount: number;
    backgroundCount: number;
    queue: PollPoolAppTaskRow[];
  };
  story: {
    totalSubmitted: number;
    totalPending: number;
    slowCount: number;
    backgroundCount: number;
    queue: PollPoolAppTaskRow[];
  };
  poll?: {
    gatewayRan?: boolean;
    autoHandler?: {
      skipped?: boolean;
      gatewaySucceededSync: number;
      slowCanvasRecovered: number;
      slowGatewayRecovered: number;
      scanned: number;
    } | null;
  };
  error?: string;
};

const POLL_MS = 20_000;

function formatAgeSec(sec: number): string {
  return formatDurationSeconds(sec * 1000);
}

function BackgroundBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-2 rounded-full border border-[var(--gw-accent)]/40 bg-[var(--gw-accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--gw-accent)]">
      后台
    </span>
  );
}

function SlowBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-2 rounded-full border border-[var(--gw-accent)]/40 bg-[var(--gw-accent-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--gw-accent)]">
      预警
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = "text-[var(--gw-ink)]",
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--gw-muted)]">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-[var(--gw-muted)]">{sub}</div> : null}
    </div>
  );
}

function GatewayQueueTable({
  rows,
  onRelease,
  busyId,
}: {
  rows: PollPoolGatewayRow[];
  onRelease?: (
    id: string,
    action: "recover" | "fail",
  ) => void | Promise<void>;
  busyId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-[var(--gw-muted)]">当前无 Gateway 轮询任务</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="gw-th-row border-b border-[var(--gw-border)]">
            <th className="px-4 py-3">来源</th>
            <th className="px-4 py-3">模型</th>
            <th className="px-4 py-3">类型</th>
            <th className="px-4 py-3">已运行</th>
            <th className="px-4 py-3">poll</th>
            <th className="px-4 py-3">Vendor Task</th>
            <th className="px-4 py-3">Log ID</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-[var(--gw-border)] hover:bg-[var(--gw-hover)] ${
                row.backgroundWait
                  ? "bg-amber-500/[0.05]"
                  : row.slowWarn
                    ? "bg-orange-500/[0.04]"
                    : ""
              }`}
            >
              <td className="px-4 py-3 text-[var(--gw-ink)]">
                {row.clientSource}
                <BackgroundBadge show={row.backgroundWait} />
                <SlowBadge show={row.slowWarn && !row.backgroundWait} />
              </td>
              <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs text-[var(--gw-ink)]">
                {row.canonicalModelKey ?? row.model ?? "—"}
              </td>
              <td className="px-4 py-3 text-[var(--gw-muted)]">
                {row.providerKind ?? "—"} · {row.requestKind}
              </td>
              <td
                className={`px-4 py-3 tabular-nums ${
                  row.backgroundWait
                    ? "font-medium text-[var(--gw-accent)]"
                    : row.slowWarn
                      ? "font-medium text-[var(--gw-accent)]"
                      : "text-[var(--gw-ink)]"
                }`}
              >
                {formatAgeSec(row.ageSec)}
              </td>
              <td className="px-4 py-3 tabular-nums text-[var(--gw-muted)]">
                {row.pollCount}
                {row.lastPolledAt ? (
                  <div className="text-[10px] text-[var(--gw-muted)]">
                    {new Date(row.lastPolledAt).toLocaleTimeString()}
                  </div>
                ) : null}
              </td>
              <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-[var(--gw-muted)]">
                {row.externalTaskId ?? "—"}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/logs?highlight=${row.gatewayLogId}`}
                  className="font-mono text-xs text-[var(--gw-accent)] hover:underline"
                >
                  {row.gatewayLogId.slice(0, 10)}…
                </Link>
              </td>
              <td className="px-4 py-3">
                {(row.slowWarn || row.backgroundWait) && onRelease ? (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void onRelease(row.id, "recover")}
                      className="gw-btn-xs disabled:opacity-50"
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void onRelease(row.id, "fail")}
                      className="rounded border border-red-500/40 px-2 py-0.5 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      释放
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--gw-muted)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppQueueTable({
  rows,
  title,
  onRelease,
  busyId,
}: {
  rows: PollPoolAppTaskRow[];
  title: string;
  onRelease?: (
    id: string,
    action: "recover" | "fail",
  ) => void | Promise<void>;
  busyId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-[var(--gw-muted)]">当前无 {title} 待 poll 任务</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="gw-th-row border-b border-[var(--gw-border)]">
            <th className="px-4 py-3">状态</th>
            <th className="px-4 py-3">项目</th>
            <th className="px-4 py-3">类型</th>
            <th className="px-4 py-3">已等待</th>
            <th className="px-4 py-3">poll</th>
            <th className="px-4 py-3">Gateway Log</th>
            <th className="px-4 py-3">Task ID</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-[var(--gw-border)] hover:bg-[var(--gw-hover)] ${
                row.backgroundWait
                  ? "bg-amber-500/[0.05]"
                  : row.slowWarn
                    ? "bg-orange-500/[0.04]"
                    : ""
              }`}
            >
              <td className="px-4 py-3 text-[var(--gw-ink)]">
                {row.status}
                <BackgroundBadge show={row.backgroundWait} />
                <SlowBadge show={row.slowWarn && !row.backgroundWait} />
              </td>
              <td className="max-w-[180px] truncate px-4 py-3 text-[var(--gw-ink)]">
                {row.projectName}
              </td>
              <td className="px-4 py-3 text-[var(--gw-muted)]">
                {row.kind}
                {row.nodeId ? ` · ${row.nodeId}` : ""}
              </td>
              <td
                className={`px-4 py-3 tabular-nums ${
                  row.backgroundWait
                    ? "font-medium text-[var(--gw-accent)]"
                    : row.slowWarn
                      ? "font-medium text-[var(--gw-accent)]"
                      : "text-[var(--gw-ink)]"
                }`}
              >
                {formatAgeSec(row.ageSec)}
              </td>
              <td className="px-4 py-3 tabular-nums text-[var(--gw-muted)]">
                {row.pollCount}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[var(--gw-muted)]">
                {row.gatewayLogId ? (
                  <Link
                    href={`/dashboard/logs?highlight=${row.gatewayLogId}`}
                    className="text-[var(--gw-accent)] hover:underline"
                  >
                    {row.gatewayLogId.slice(0, 10)}…
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-[var(--gw-muted)]">
                {row.id}
              </td>
              <td className="px-4 py-3">
                {(row.slowWarn || row.backgroundWait) && onRelease && row.app === "canvas" ? (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void onRelease(row.id, "recover")}
                      className="gw-btn-xs disabled:opacity-50"
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void onRelease(row.id, "fail")}
                      className="rounded border border-red-500/40 px-2 py-0.5 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      释放
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--gw-muted)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PollPoolView() {
  const [data, setData] = useState<PollPoolResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowWarnDraft, setSlowWarnDraft] = useState("800");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [releaseBusyId, setReleaseBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [backgroundOnly, setBackgroundOnly] = useState(false);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (opts?: { poll?: boolean; background?: boolean }) => {
    const isBackground = opts?.background === true;
    if (!isBackground) {
      setRefreshing(true);
    }
    if (!hasLoadedRef.current && !isBackground) {
      setInitialLoading(true);
    }
    setError(null);
    const qs = new URLSearchParams({ scope: "all" });
    if (opts?.poll) qs.set("poll", "1");
    else if (isBackground) qs.set("skipPoll", "1");
    const res = await fetch(`/api/book-mall/api/gateway/poll-pool?${qs.toString()}`);
    const body = (await res.json().catch(() => null)) as PollPoolResponse | null;
    if (!res.ok) {
      setError(body?.error ?? `加载失败（${res.status}）`);
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }
    setData(body);
    hasLoadedRef.current = true;
    if (body?.config.slowWarnSec) {
      setSlowWarnDraft(String(body.config.slowWarnSec));
    }
    const auto = body?.poll?.autoHandler;
    if (
      auto &&
      !auto.skipped &&
      (auto.gatewaySucceededSync > 0 ||
        auto.slowCanvasRecovered > 0 ||
        auto.slowGatewayRecovered > 0)
    ) {
      const parts: string[] = [];
      if (auto.gatewaySucceededSync > 0) {
        parts.push(`Gateway 已成功同步 ${auto.gatewaySucceededSync} 条 Canvas`);
      }
      if (auto.slowCanvasRecovered > 0) {
        parts.push(`Canvas 恢复 ${auto.slowCanvasRecovered} 条`);
      }
      if (auto.slowGatewayRecovered > 0) {
        parts.push(`Gateway 恢复 ${auto.slowGatewayRecovered} 条`);
      }
      setActionMsg(`预警自动处理：${parts.join(" · ")}`);
    }
    setInitialLoading(false);
    setRefreshing(false);
  }, []);

  const saveThreshold = useCallback(async () => {
    const sec = Number(slowWarnDraft);
    if (!Number.isFinite(sec) || sec < 60 || sec > 7200) {
      setActionMsg("预警阈值须在 60～7200 秒之间");
      return;
    }
    setSavingThreshold(true);
    setActionMsg(null);
    const res = await fetch("/api/book-mall/api/gateway/poll-pool", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slowWarnSec: sec }),
    });
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      slowWarnSec?: number;
    } | null;
    setSavingThreshold(false);
    if (!res.ok) {
      setActionMsg(body?.error ?? `保存失败（${res.status}）`);
      return;
    }
    setActionMsg(`已保存预警阈值 ${body?.slowWarnSec ?? sec}s（全站 poll / 状态 Tab 生效）`);
    void load();
  }, [load, slowWarnDraft]);

  const releaseTask = useCallback(
    async (
      target: "gateway" | "canvas",
      id: string,
      action: "recover" | "fail",
    ) => {
      setReleaseBusyId(id);
      setActionMsg(null);
      const res = await fetch("/api/book-mall/api/gateway/poll-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, id, action }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      setReleaseBusyId(null);
      if (!res.ok || !body?.ok) {
        setActionMsg(body?.message ?? body?.error ?? `操作失败（${res.status}）`);
        return;
      }
      setActionMsg(`${action === "recover" ? "恢复" : "释放"}成功：${body.message ?? id}`);
      void load({ poll: true });
    },
    [load],
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ background: true });
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--gw-ink)]">轮询池</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--gw-muted)]">
            Gateway worker 正在 poll 的 RUNNING 任务，以及 Canvas / Story 待 poll
            队列。超过预警线的任务会<strong className="text-[var(--gw-accent)]">自动升格 poll</strong>
            并尝试写回画布；存在预警任务时每 10s 自动 poll + 恢复，仍卡住可手动「恢复」或「释放」。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="rounded-md border border-[var(--gw-border)] px-4 py-2 text-sm text-[var(--gw-ink)] hover:bg-[var(--gw-hover)] disabled:opacity-50"
          >
            {refreshing ? "刷新中…" : "刷新快照"}
          </button>
          <button
            type="button"
            onClick={() => void load({ poll: true })}
            disabled={refreshing}
            className="gw-btn"
          >
            立即 poll
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {actionMsg ? (
        <div className="rounded-lg border border-[var(--gw-border)] bg-white/5 px-4 py-3 text-sm text-[var(--gw-ink)]">
          {actionMsg}
        </div>
      ) : null}

      {data ? (
        <>
          {(() => {
            const totalBackgroundCount =
              data.gateway.backgroundCount +
              data.canvas.backgroundCount +
              data.story.backgroundCount;
            const filterRows = <T extends { backgroundWait: boolean }>(rows: T[]) =>
              backgroundOnly ? rows.filter((row) => row.backgroundWait) : rows;
            return (
              <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--gw-ink)]">
              <input
                type="checkbox"
                checked={backgroundOnly}
                onChange={(e) => setBackgroundOnly(e.target.checked)}
                className="rounded border-white/20 bg-black/30"
              />
              仅显示后台等待（≥{data.config.backgroundWaitSec}s）
            </label>
            {totalBackgroundCount > 0 ? (
              <span className="text-xs text-[var(--gw-accent)]/90">
                当前 {totalBackgroundCount} 条 · Canvas 侧应显示「持续后台生成中」
              </span>
            ) : null}
          </div>
          <section className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--gw-accent)]/80">
                  预警阈值（秒）
                </div>
                <p className="mt-1 text-xs text-[var(--gw-muted)]">
                  写入 PlatformConfig · 全站 poll 升格与状态页「预警」Tab 共用
                  {data.config.slowWarnSource === "env" ? "（当前 fallback 环境变量）" : ""}
                </p>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="number"
                  min={60}
                  max={7200}
                  value={slowWarnDraft}
                  onChange={(e) => setSlowWarnDraft(e.target.value)}
                  className="w-28 rounded-md border border-[var(--gw-border)] bg-black/30 px-3 py-2 text-sm text-[var(--gw-ink)]"
                />
                <span className="text-sm text-[var(--gw-muted)]">s</span>
              </label>
              <button
                type="button"
                onClick={() => void saveThreshold()}
                disabled={savingThreshold}
                className="gw-btn-sm disabled:opacity-50"
              >
                {savingThreshold ? "保存中…" : "保存阈值"}
              </button>
              <div className="text-sm text-[var(--gw-muted)]">
                当前生效：<span className="tabular-nums text-[var(--gw-accent)]">{data.config.slowWarnSec}s</span>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Gateway RUNNING"
              value={data.gateway.total}
              sub={`后台 ${data.gateway.backgroundCount} · 预警 ${data.gateway.slowCount}`}
              accent="text-amber-300"
            />
            <StatCard
              label="Canvas 待 poll"
              value={data.canvas.totalSubmitted + data.canvas.totalPending}
              sub={`后台 ${data.canvas.backgroundCount} · 预警 ${data.canvas.slowCount}`}
              accent="text-[var(--gw-accent)]"
            />
            <StatCard
              label="Story 待 poll"
              value={data.story.totalSubmitted + data.story.totalPending}
              sub={`后台 ${data.story.backgroundCount} · 预警 ${data.story.slowCount}`}
              accent="text-violet-300"
            />
            <StatCard
              label="后台阈值"
              value={data.config.backgroundWaitSec}
              sub={`固定 10min · 当前 ${totalBackgroundCount} 条`}
              accent="text-amber-300"
            />
          </div>

          <section className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)]">
            <div className="border-b border-[var(--gw-border)] px-4 py-3">
              <h2>Gateway 轮询队列</h2>
              <p className="mt-1 text-xs text-[var(--gw-muted)]">
                与 runGatewayPollWorker 相同口径 · 慢任务优先 · 本页展示前{" "}
                {filterRows(data.gateway.queue).length} 条
              </p>
            </div>
            <GatewayQueueTable
              rows={filterRows(data.gateway.queue)}
              busyId={releaseBusyId}
              onRelease={(id, action) => releaseTask("gateway", id, action)}
            />
          </section>

          <section className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)]">
            <div className="border-b border-[var(--gw-border)] px-4 py-3">
              <h2>Canvas poll 池</h2>
            </div>
            <AppQueueTable
              rows={filterRows(data.canvas.queue)}
              title="Canvas"
              busyId={releaseBusyId}
              onRelease={(id, action) => releaseTask("canvas", id, action)}
            />
          </section>

          <section className="rounded-lg border border-[var(--gw-border)] bg-[var(--gw-surface)]">
            <div className="border-b border-[var(--gw-border)] px-4 py-3">
              <h2>Story poll 池</h2>
            </div>
            <AppQueueTable rows={filterRows(data.story.queue)} title="Story" />
          </section>

          {data.serverTime ? (
            <p className="text-xs text-[var(--gw-muted)]">
              快照时间 {new Date(data.serverTime).toLocaleString()} · 每 {POLL_MS / 1000}s 自动刷新
            </p>
          ) : null}
              </>
            );
          })()}
        </>
      ) : initialLoading ? (
        <p className="text-sm text-[var(--gw-muted)]">正在加载轮询池…</p>
      ) : null}
      {refreshing && data ? (
        <p className="text-xs text-[var(--gw-muted)]">后台刷新中…</p>
      ) : null}
    </div>
  );
}
