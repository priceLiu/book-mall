"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

type CanvasTask = {
  id: string;
  projectId: string;
  nodeId: string;
  kind: "IMAGE" | "TEXT";
  status: "PENDING" | "SUBMITTED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  model: string;
  kieTaskId: string | null;
  inputPayload: unknown;
  resultPayload: unknown;
  ephemeralUrl: string | null;
  ossUrl: string | null;
  textOutput: string | null;
  failCode: string | null;
  failMessage: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  lastPolledAt: string | null;
  pollCount: number;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
};

type ListResp = {
  fetchedAt: string;
  total: number;
  counts: Record<string, number>;
  tasks: CanvasTask[];
};

type PollResp = {
  ranAt: string;
  scanned: number;
  retried: number;
  succeeded: number;
  failed: number;
  timedOut: number;
};

const KIND_TABS: { id: "ALL" | CanvasTask["kind"]; label: string }[] = [
  { id: "ALL", label: "全部" },
  { id: "IMAGE", label: "图片生成" },
  { id: "TEXT", label: "AI 文本" },
];

const STATUS_OPTS: { id: "ALL" | CanvasTask["status"]; label: string }[] = [
  { id: "ALL", label: "全部状态" },
  { id: "PENDING", label: "待提交" },
  { id: "SUBMITTED", label: "进行中" },
  { id: "SUCCEEDED", label: "成功" },
  { id: "FAILED", label: "失败" },
  { id: "CANCELLED", label: "已取消" },
];

function statusColor(s: CanvasTask["status"]): { dot: string; text: string } {
  switch (s) {
    case "SUCCEEDED":
      return { dot: "bg-emerald-400", text: "text-emerald-300" };
    case "FAILED":
      return { dot: "bg-red-400", text: "text-red-300" };
    case "CANCELLED":
      return { dot: "bg-zinc-500", text: "text-zinc-400" };
    case "SUBMITTED":
      return { dot: "bg-violet-400 animate-pulse", text: "text-violet-300" };
    case "PENDING":
    default:
      return { dot: "bg-amber-400", text: "text-amber-300" };
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatDuration(t: CanvasTask): string {
  const start = t.submittedAt ?? t.createdAt;
  const end =
    t.completedAt ??
    (t.status === "SUBMITTED" ? new Date().toISOString() : null);
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  return `${Math.round(ms / 1000)}s`;
}

function shortenJson(v: unknown, max = 80): string {
  let s: string;
  try {
    s = JSON.stringify(v);
  } catch {
    s = String(v);
  }
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={label ?? "复制"}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* noop */
        }
      }}
      className="inline-flex size-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function ResultButton({ task }: { task: CanvasTask }) {
  const url = task.ossUrl ?? task.ephemeralUrl;
  if (!url) return <span className="text-xs text-zinc-600">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25"
    >
      <ExternalLink className="size-3" />
      结果
    </a>
  );
}

export function CanvasTasksClient() {
  const [tasks, setTasks] = useState<CanvasTask[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<PollResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<"ALL" | CanvasTask["kind"]>(
    "ALL",
  );
  const [activeStatus, setActiveStatus] = useState<
    "ALL" | CanvasTask["status"]
  >("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (activeKind !== "ALL") params.set("kind", activeKind);
      if (activeStatus !== "ALL") params.set("status", activeStatus);
      params.set("limit", "200");
      const r = await fetch(`/api/dev/canvas/tasks?${params.toString()}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`request_failed_${r.status}`);
      const data = (await r.json()) as ListResp;
      setTasks(data.tasks);
      setCounts(data.counts);
      setFetchedAt(data.fetchedAt);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeKind, activeStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasInflight = tasks.some(
      (t) => t.status === "SUBMITTED" || t.status === "PENDING",
    );
    if (!hasInflight) return;
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [tasks, load]);

  const triggerPoll = useCallback(async () => {
    setPolling(true);
    try {
      const r = await fetch("/api/dev/canvas/tasks/poll", { method: "POST" });
      if (!r.ok) throw new Error(`poll_failed_${r.status}`);
      const data = (await r.json()) as PollResp;
      setPollResult(data);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "回调失败");
    } finally {
      setPolling(false);
    }
  }, [load]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const totalAll = useMemo(
    () =>
      Object.values(counts).reduce(
        (acc, n) => acc + (typeof n === "number" ? n : 0),
        0,
      ),
    [counts],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/dev"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            返回 Dev
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-white sm:text-base">
              KIE 任务（CanvasGenerationTask）
            </h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              共 {totalAll} 条 · 上次刷新{" "}
              {fetchedAt
                ? new Date(fetchedAt).toLocaleTimeString("zh-CN")
                : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            刷新
          </button>
          <button
            type="button"
            onClick={() => void triggerPoll()}
            disabled={polling}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-sm transition hover:bg-violet-400 disabled:opacity-60"
          >
            {polling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            批量回调（poll-once）
          </button>
        </div>

        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 border-t border-zinc-800/70 px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-1">
            {KIND_TABS.map((tab) => {
              const active = activeKind === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveKind(tab.id)}
                  className={`rounded-md px-3 py-1 text-xs transition ${
                    active
                      ? "bg-zinc-200 text-zinc-900"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <span className="mx-2 h-4 w-px bg-zinc-800" />
          <select
            value={activeStatus}
            onChange={(e) =>
              setActiveStatus(e.target.value as typeof activeStatus)
            }
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
          >
            {STATUS_OPTS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
                {opt.id !== "ALL" && counts[opt.id] != null
                  ? ` (${counts[opt.id]})`
                  : ""}
              </option>
            ))}
          </select>
          {pollResult ? (
            <span className="ml-auto text-[11px] text-zinc-500">
              上次回调{" "}
              {new Date(pollResult.ranAt).toLocaleTimeString("zh-CN")}
              ：扫描 {pollResult.scanned} · 成功 {pollResult.succeeded} · 失败{" "}
              {pollResult.failed} · 超时 {pollResult.timedOut}
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {error ? (
          <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-zinc-400">
            <Loader2 className="size-4 animate-spin" />
            加载中…
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
            没有匹配的任务
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="w-[200px] px-3 py-2.5 font-medium">
                    模型 / 时间
                  </th>
                  <th className="w-[260px] px-3 py-2.5 font-medium">参数</th>
                  <th className="w-[110px] px-3 py-2.5 font-medium">状态</th>
                  <th className="w-[120px] px-3 py-2.5 font-medium">
                    耗时 · Poll
                  </th>
                  <th className="w-[200px] px-3 py-2.5 font-medium">任务 ID</th>
                  <th className="w-[200px] px-3 py-2.5 font-medium">画布</th>
                  <th className="w-[110px] px-3 py-2.5 font-medium">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                {tasks.map((t) => {
                  const sc = statusColor(t.status);
                  const open = expanded.has(t.id);
                  return (
                    <Fragment key={t.id}>
                      <tr
                        className="cursor-pointer transition hover:bg-zinc-900/60"
                        onClick={() => toggleExpanded(t.id)}
                      >
                        <td className="px-3 py-2.5 align-top">
                          <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-medium text-zinc-200">
                            {t.model}
                          </span>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {formatDateTime(t.createdAt)}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                            {t.kind} · node {t.nodeId.slice(0, 6)}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <code className="block whitespace-pre-wrap break-all font-mono text-[10.5px] leading-snug text-zinc-400">
                            {shortenJson(t.inputPayload, 120)}
                          </code>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 ${sc.text}`}
                          >
                            <span className={`size-2 rounded-full ${sc.dot}`} />
                            {t.status === "SUCCEEDED"
                              ? "成功"
                              : t.status === "FAILED"
                                ? "失败"
                                : t.status === "SUBMITTED"
                                  ? "进行中"
                                  : t.status === "PENDING"
                                    ? "待提交"
                                    : "已取消"}
                          </span>
                          {t.failCode ? (
                            <p className="mt-1 line-clamp-2 text-[10px] text-red-300/80">
                              {t.failCode}: {t.failMessage ?? ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 align-top text-[11px] text-zinc-400">
                          <p>{formatDuration(t)}</p>
                          <p className="text-[10px] text-zinc-600">
                            poll {t.pollCount}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          {t.kieTaskId ? (
                            <div className="flex items-center gap-1">
                              <code className="truncate font-mono text-[10.5px] text-zinc-400">
                                {t.kieTaskId}
                              </code>
                              <CopyButton
                                value={t.kieTaskId}
                                label="复制 KIE taskId"
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                          <p className="mt-0.5 text-[10px] text-zinc-600">
                            local {t.id.slice(0, 10)}…
                          </p>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          {t.project ? (
                            <span className="text-[11px] text-zinc-300">
                              {t.project.name}
                              <span className="ml-1 text-zinc-600">
                                ({t.project.id.slice(0, 6)})
                              </span>
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <ResultButton task={t} />
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-zinc-950/70">
                          <td colSpan={7} className="px-3 py-3">
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div>
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                                  inputPayload
                                </p>
                                <pre className="max-h-72 overflow-auto rounded-md border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-[10.5px] leading-snug text-zinc-300">
                                  {JSON.stringify(t.inputPayload, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                                  resultPayload
                                </p>
                                <pre className="max-h-72 overflow-auto rounded-md border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-[10.5px] leading-snug text-zinc-300">
                                  {t.resultPayload
                                    ? JSON.stringify(t.resultPayload, null, 2)
                                    : "—"}
                                </pre>
                              </div>
                              <div className="grid gap-2 text-[11px] text-zinc-400 lg:col-span-2 sm:grid-cols-3">
                                <div>
                                  <span className="text-zinc-500">
                                    submittedAt：
                                  </span>
                                  {formatDateTime(t.submittedAt)}
                                </div>
                                <div>
                                  <span className="text-zinc-500">
                                    completedAt：
                                  </span>
                                  {formatDateTime(t.completedAt)}
                                </div>
                                <div>
                                  <span className="text-zinc-500">
                                    lastPolledAt：
                                  </span>
                                  {formatDateTime(t.lastPolledAt)}
                                </div>
                                {t.ossUrl ? (
                                  <div className="sm:col-span-3">
                                    <span className="text-zinc-500">
                                      ossUrl：
                                    </span>
                                    <a
                                      href={t.ossUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="break-all text-violet-300 hover:underline"
                                    >
                                      {t.ossUrl}
                                    </a>
                                  </div>
                                ) : null}
                                {t.ephemeralUrl ? (
                                  <div className="sm:col-span-3">
                                    <span className="text-zinc-500">
                                      ephemeralUrl：
                                    </span>
                                    <a
                                      href={t.ephemeralUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="break-all text-amber-300 hover:underline"
                                    >
                                      {t.ephemeralUrl}
                                    </a>
                                  </div>
                                ) : null}
                                {t.textOutput ? (
                                  <div className="sm:col-span-3">
                                    <span className="text-zinc-500">
                                      textOutput：
                                    </span>
                                    <span className="whitespace-pre-wrap break-all text-zinc-200">
                                      {t.textOutput}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
