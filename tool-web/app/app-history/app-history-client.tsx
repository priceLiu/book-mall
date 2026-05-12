"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toolKeyToLabel } from "@/lib/tool-key-label";

export type UsageEventRow = {
  id: string;
  toolKey: string;
  action: string;
  meta: unknown;
  costMinor: number | null;
  createdAt: string;
};

type GroupedRow = {
  toolKey: string;
  label: string;
  count: number;
  sumCostMinor: number;
  lastAt: string;
  lastAction: string;
};

function formatYuan(minor: number): string {
  if (!minor || minor <= 0) return "—";
  return `${(minor / 100).toFixed(2)} 元`;
}

function aggregate(events: UsageEventRow[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>();
  for (const e of events) {
    const key = e.toolKey;
    const row =
      map.get(key) ??
      ({
        toolKey: key,
        label: toolKeyToLabel(key),
        count: 0,
        sumCostMinor: 0,
        lastAt: e.createdAt,
        lastAction: e.action,
      } as GroupedRow);
    row.count += 1;
    row.sumCostMinor += typeof e.costMinor === "number" ? e.costMinor : 0;
    if (new Date(e.createdAt).getTime() > new Date(row.lastAt).getTime()) {
      row.lastAt = e.createdAt;
      row.lastAction = e.action;
    }
    map.set(key, row);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
}

export function AppHistoryClient() {
  const [events, setEvents] = useState<UsageEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
        setError(typeof data.error === "string" ? data.error : `HTTP ${r.status}`);
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

  const grouped = useMemo(() => aggregate(events), [events]);

  const eventsForExpanded = useMemo(() => {
    if (!expanded) return [];
    return events.filter((e) => e.toolKey === expanded).slice(0, 20);
  }, [events, expanded]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <span className="tw-muted" style={{ fontSize: "0.875rem" }}>
          按 <strong>工具</strong> 汇总（最近 100 条）
        </span>
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
      ) : grouped.length === 0 ? (
        <p className="tw-muted">
          暂无记录。访问任一工具页或完成一次 AI 试衣后会在此出现。
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "640px",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--tool-border, #ddd)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>工具</th>
                <th style={{ textAlign: "right", padding: "0.5rem" }}>使用次数</th>
                <th style={{ textAlign: "right", padding: "0.5rem" }}>合计消耗</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>最近使用</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>动作</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => {
                const isOpen = expanded === g.toolKey;
                return (
                  <>
                    <tr
                      key={g.toolKey}
                      style={{ borderBottom: "1px solid var(--tool-border, #eee)" }}
                    >
                      <td style={{ padding: "0.5rem" }}>
                        <div style={{ fontWeight: 600 }}>{g.label}</div>
                        <div className="tw-muted" style={{ fontSize: "0.75rem" }}>
                          <code>{g.toolKey}</code>
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>
                        {g.count}
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>
                        {formatYuan(g.sumCostMinor)}
                      </td>
                      <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                        {new Date(g.lastAt).toLocaleString("zh-CN")}
                      </td>
                      <td style={{ padding: "0.5rem" }}>{g.lastAction}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : g.toolKey)}
                          style={{ cursor: "pointer", fontSize: "0.8rem" }}
                        >
                          {isOpen ? "收起" : "明细"}
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr key={`${g.toolKey}__detail`}>
                        <td colSpan={6} style={{ padding: "0 0.5rem 0.75rem" }}>
                          <div
                            style={{
                              background: "var(--tool-surface, #f8f8f8)",
                              border: "1px solid var(--tool-border, #eee)",
                              borderRadius: "6px",
                              padding: "0.5rem 0.75rem",
                            }}
                          >
                            <div
                              className="tw-muted"
                              style={{ fontSize: "0.75rem", marginBottom: "0.25rem" }}
                            >
                              最近 {eventsForExpanded.length} 条
                            </div>
                            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                              {eventsForExpanded.map((row) => (
                                <li
                                  key={row.id}
                                  style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}
                                >
                                  <span style={{ color: "var(--tool-muted, #666)" }}>
                                    {new Date(row.createdAt).toLocaleString("zh-CN")}
                                  </span>
                                  {" · "}
                                  {row.action}
                                  {typeof row.costMinor === "number" && row.costMinor > 0 ? (
                                    <>
                                      {" · "}
                                      <strong>{formatYuan(row.costMinor)}</strong>
                                    </>
                                  ) : null}
                                  {row.meta != null ? (
                                    <>
                                      {" · "}
                                      <code style={{ fontSize: "0.72rem" }}>
                                        {JSON.stringify(row.meta).slice(0, 160)}
                                      </code>
                                    </>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
