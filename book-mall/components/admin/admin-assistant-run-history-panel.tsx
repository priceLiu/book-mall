"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

import type {
  PlatformAssistantRunHistoryFilter,
  PlatformAssistantRunHistoryItem,
} from "@/lib/platform-assistant/run-history-service";

const FILTER_TABS: { id: PlatformAssistantRunHistoryFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "success", label: "成功" },
  { id: "failed", label: "失败" },
  { id: "running", label: "进行中" },
];

const OUTCOME_LABEL: Record<
  PlatformAssistantRunHistoryItem["outcome"],
  { text: string; className: string }
> = {
  success: { text: "成功", className: "bg-[#dafbe1] text-[#1a7f37]" },
  failed: { text: "失败", className: "bg-[#ffebe9] text-[#cf1322]" },
  running: { text: "进行中", className: "bg-[#fff8c5] text-[#9a6700]" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN");
}

function fmtDuration(ms: number | null) {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function AdminAssistantRunHistoryPanel({
  initialItems,
  initialNextCursorId,
  summary,
}: {
  initialItems: PlatformAssistantRunHistoryItem[];
  initialNextCursorId: string | null;
  summary: { last24hTotal: number; last24hSucceeded: number; last24hFailed: number };
}) {
  const [filter, setFilter] = useState<PlatformAssistantRunHistoryFilter>("all");
  const [items, setItems] = useState(initialItems);
  const [nextCursorId, setNextCursorId] = useState(initialNextCursorId);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (opts: {
      filter: PlatformAssistantRunHistoryFilter;
      cursor?: string | null;
      append?: boolean;
    }) => {
      const qs = new URLSearchParams({ filter: opts.filter, limit: "50" });
      if (opts.cursor) qs.set("cursor", opts.cursor);
      const res = await fetch(`/api/admin/platform-assistant/runs?${qs}`);
      if (!res.ok) throw new Error("加载失败");
      const json = (await res.json()) as {
        items: PlatformAssistantRunHistoryItem[];
        nextCursorId: string | null;
      };
      setItems((prev) => (opts.append ? [...prev, ...json.items] : json.items));
      setNextCursorId(json.nextCursorId);
    },
    [],
  );

  async function onFilterChange(next: PlatformAssistantRunHistoryFilter) {
    setFilter(next);
    setError(null);
    setLoading(true);
    try {
      await loadPage({ filter: next });
    } catch {
      setError("无法加载运行记录，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function onLoadMore() {
    if (!nextCursorId || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await loadPage({ filter, cursor: nextCursorId, append: true });
    } catch {
      setError("加载更多失败");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1f2328]">AI 小智 · 运行历史</h2>
        <p className="mt-0.5 text-sm text-[#656d76]">
          Gateway 调用记录（对话、资讯生成、向量检索等）；含成功 / 失败与提交时间
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">24h 调用</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.last24hTotal}</p>
        </div>
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">24h 成功</p>
          <p className="text-2xl font-semibold tabular-nums text-[#1a7f37]">
            {summary.last24hSucceeded}
          </p>
        </div>
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">24h 失败</p>
          <p className="text-2xl font-semibold tabular-nums text-[#cf1322]">
            {summary.last24hFailed}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={loading}
            onClick={() => void onFilterChange(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === t.id
                ? "bg-[#0969da] text-white"
                : "border border-[#d1d9e0] bg-white text-[#656d76] hover:border-[#0969da]"
            }`}
          >
            {t.label}
          </button>
        ))}
        {loading ? (
          <span className="inline-flex items-center gap-1 text-sm text-[#656d76]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            加载中
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[#cf1322]">{error}</p> : null}

      {items.length === 0 && !loading ? (
        <p className="rounded-lg border border-dashed border-[#d1d9e0] px-4 py-8 text-center text-sm text-[#656d76]">
          暂无运行记录
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#d1d9e0] bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#d1d9e0] text-left text-[#656d76]">
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">场景</th>
                <th className="px-3 py-2 font-medium">模型</th>
                <th className="px-3 py-2 font-medium">提交时间</th>
                <th className="px-3 py-2 font-medium">耗时</th>
                <th className="px-3 py-2 font-medium">触发用户</th>
                <th className="px-3 py-2 font-medium">失败原因</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const badge = OUTCOME_LABEL[row.outcome];
                return (
                  <tr key={row.id} className="border-b border-[#d1d9e0]/70 last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{row.sceneLabel}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs" title={row.model}>
                      {row.model}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-[#656d76]">
                      {fmtTime(row.submittedAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs">{fmtDuration(row.durationMs)}</td>
                    <td
                      className="max-w-[8rem] truncate px-3 py-2 font-mono text-xs text-[#656d76]"
                      title={row.actorBookUserId ?? undefined}
                    >
                      {row.actorBookUserId ?? "—"}
                    </td>
                    <td
                      className="max-w-[14rem] truncate px-3 py-2 text-xs text-[#cf1322]"
                      title={row.failMessage ?? undefined}
                    >
                      {row.outcome === "failed" && row.failMessage ? row.failMessage : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {nextCursorId ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void onLoadMore()}
          className="rounded-md border border-[#d1d9e0] bg-white px-4 py-2 text-sm font-medium text-[#1f2328] hover:border-[#0969da] disabled:opacity-60"
        >
          {loadingMore ? "加载中…" : "加载更多"}
        </button>
      ) : null}
    </section>
  );
}
