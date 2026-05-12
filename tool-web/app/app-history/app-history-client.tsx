"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APP_HISTORY_TAB_DEFS,
  type AppHistoryTabId,
  usageEventMatchesTab,
} from "@/lib/app-history-tabs";

export type UsageEventRow = {
  id: string;
  toolKey: string;
  action: string;
  meta: unknown;
  costMinor: number | null;
  createdAt: string;
};

function formatMeta(meta: unknown): string {
  if (meta == null) return "—";
  try {
    const s = JSON.stringify(meta);
    return s.length > 220 ? `${s.slice(0, 220)}…` : s;
  } catch {
    return String(meta);
  }
}

function formatCost(costMinor: number | null): string {
  if (costMinor == null || costMinor <= 0) return "—";
  return `${(costMinor / 100).toFixed(2)} 元`;
}

export function AppHistoryClient() {
  const [tab, setTab] = useState<AppHistoryTabId>("all");
  const [events, setEvents] = useState<UsageEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/tool-usage?limit=100", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await r.json()) as {
        events?: UsageEventRow[];
        error?: string;
      };
      if (!r.ok) {
        setEvents([]);
        setError(
          typeof data.error === "string" ? data.error : `HTTP ${r.status}`,
        );
        return;
      }
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      setEvents([]);
      setError("加载失败，请检查网络与主站连接");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => events.filter((e) => usageEventMatchesTab(tab, e.toolKey)),
    [events, tab],
  );

  const sumCost = useMemo(
    () =>
      filtered.reduce((acc, e) => acc + (typeof e.costMinor === "number" ? e.costMinor : 0), 0),
    [filtered],
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1rem",
          alignItems: "center",
        }}
      >
        {APP_HISTORY_TAB_DEFS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
              border:
                tab === t.id
                  ? "1px solid var(--tool-accent, #111)"
                  : "1px solid var(--tool-border, #ddd)",
              background:
                tab === t.id ? "var(--tool-accent-contrast, #111)" : "transparent",
              color: tab === t.id ? "#fff" : "inherit",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          style={{
            marginLeft: "auto",
            padding: "0.35rem 0.75rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p className="tw-muted">加载中…</p>
      ) : error ? (
        <p className="tw-muted" style={{ color: "crimson" }}>
          {error}
          {" · "}
          <button type="button" onClick={() => void load()}>
            重试
          </button>
          {"（未登录工具站会话时会提示 no_session）"}
        </p>
      ) : filtered.length === 0 ? (
        <p className="tw-muted">当前 Tab 下暂无记录。浏览工具页或完成 AI 试衣后会出现打点。</p>
      ) : (
        <>
          <p className="tw-muted" style={{ marginBottom: "0.75rem", fontSize: "0.875rem" }}>
            共 {filtered.length} 条
            {sumCost > 0 ? ` · 本页展示合计消耗约 ${(sumCost / 100).toFixed(2)} 元（分栏汇总）` : null}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: "720px",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--tool-border, #ddd)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>时间</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>工具</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>动作</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>消耗</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>详情</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid var(--tool-border, #eee)",
                      verticalAlign: "top",
                    }}
                  >
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {new Date(row.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td style={{ padding: "0.5rem", wordBreak: "break-all" }}>
                      <code>{row.toolKey}</code>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{row.action}</td>
                    <td style={{ padding: "0.5rem" }}>{formatCost(row.costMinor)}</td>
                    <td style={{ padding: "0.5rem", wordBreak: "break-word" }}>
                      {formatMeta(row.meta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
