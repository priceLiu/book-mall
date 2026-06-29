"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type PlatformErrorRow = {
  id: string;
  createdAt: string;
  source: string;
  severity: string;
  code: string | null;
  message: string;
  detail: string | null;
  context: Record<string, unknown> | null;
  occurrenceCount: number;
  resolvedAt: string | null;
  resolvedNote: string | null;
};

const SOURCE_OPTIONS = [
  { value: "", label: "全部来源" },
  { value: "CANVAS", label: "Canvas" },
  { value: "GATEWAY", label: "Gateway" },
  { value: "STORY", label: "Story" },
  { value: "BOOK", label: "Book" },
  { value: "TOOL", label: "Tool" },
  { value: "SYSTEM", label: "System" },
];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function contextSummary(ctx: Record<string, unknown> | null): string {
  if (!ctx) return "—";
  const parts: string[] = [];
  if (typeof ctx.projectId === "string") parts.push(`project ${ctx.projectId.slice(0, 8)}…`);
  if (typeof ctx.nodeId === "string") parts.push(`node ${ctx.nodeId.slice(0, 8)}…`);
  if (typeof ctx.modelKey === "string") parts.push(ctx.modelKey);
  if (typeof ctx.gatewayLogId === "string") parts.push(`gw ${ctx.gatewayLogId.slice(0, 8)}…`);
  return parts.length ? parts.join(" · ") : "—";
}

export function PlatformErrorsAdminClient() {
  const [items, setItems] = useState<PlatformErrorRow[]>([]);
  const [source, setSource] = useState("");
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (source) q.set("source", source);
      if (unresolvedOnly) q.set("unresolved", "1");
      q.set("take", "80");
      const r = await fetch(`/api/admin/platform-errors?${q.toString()}`);
      const j = (await r.json()) as { items?: PlatformErrorRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setItems(j.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [source, unresolvedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleResolved = async (row: PlatformErrorRow) => {
    const resolved = !row.resolvedAt;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/platform-errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, resolved }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">来源</span>
          <select
            className="rounded-md border border-secondary bg-background px-3 py-2 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
          />
          仅未处理
        </label>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-secondary px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50"
          onClick={() => void load()}
        >
          刷新
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">时间</th>
              <th className="p-3 font-medium">来源</th>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">摘要</th>
              <th className="p-3 font-medium">上下文</th>
              <th className="p-3 font-medium">次数</th>
              <th className="p-3 font-medium">状态</th>
              <th className="p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-b border-secondary/60 hover:bg-muted/30">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {formatTime(row.createdAt)}
                  </td>
                  <td className="p-3">{row.source}</td>
                  <td className="p-3 font-mono text-xs">{row.code ?? "—"}</td>
                  <td className="max-w-md p-3">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() =>
                        setExpandedId((id) => (id === row.id ? null : row.id))
                      }
                    >
                      {row.message.length > 120
                        ? `${row.message.slice(0, 117)}…`
                        : row.message}
                    </button>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {contextSummary(row.context)}
                  </td>
                  <td className="p-3 tabular-nums">{row.occurrenceCount}</td>
                  <td className="p-3">
                    {row.resolvedAt ? (
                      <span className="text-emerald-600">已处理</span>
                    ) : (
                      <span className="text-amber-600">待处理</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border border-secondary px-2 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
                      onClick={() => void toggleResolved(row)}
                    >
                      {row.resolvedAt ? "重新打开" : "标记已处理"}
                    </button>
                  </td>
                </tr>
                {expandedId === row.id ? (
                  <tr key={`${row.id}-detail`} className="bg-muted/20">
                    <td colSpan={8} className="p-4 text-xs">
                      {row.detail ? (
                        <pre className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-3">
                          {row.detail}
                        </pre>
                      ) : null}
                      {row.context ? (
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-3">
                          {JSON.stringify(row.context, null, 2)}
                        </pre>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {!items.length && !busy ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  暂无错误记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
