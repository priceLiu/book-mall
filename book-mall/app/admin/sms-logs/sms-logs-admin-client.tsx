"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type SmsLogRow = {
  id: string;
  createdAt: string;
  phone: string;
  purpose: string;
  code: string | null;
  source: string;
  channel: string;
  status: string;
  provider: string | null;
  templateId: string | null;
  sendIp: string | null;
  userAgent: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  detailJson: Record<string, unknown> | null;
  verificationId: string | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "SUCCESS", label: "成功" },
  { value: "MOCK", label: "Mock" },
  { value: "FAILED", label: "失败" },
  { value: "RATE_LIMITED", label: "限速" },
] as const;

const PURPOSE_LABEL: Record<string, string> = {
  REGISTER: "注册",
  LOGIN: "登录",
  BIND_PHONE: "绑手机",
  TEAM_INVITE: "团队邀请",
  RESET_PASSWORD: "重置密码",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "成功",
  MOCK: "Mock",
  FAILED: "失败",
  RATE_LIMITED: "限速",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "SUCCESS":
    case "MOCK":
      return "text-emerald-600";
    case "FAILED":
      return "text-red-600";
    case "RATE_LIMITED":
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}

export function SmsLogsAdminClient() {
  const [items, setItems] = useState<SmsLogRow[]>([]);
  const [stats, setStats] = useState({ total24h: 0, failed24h: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { cursor?: string | null; append?: boolean }) => {
      setBusy(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        if (statusFilter) q.set("status", statusFilter);
        if (sourceFilter.trim()) q.set("source", sourceFilter.trim());
        if (phoneQuery.trim()) q.set("phone", phoneQuery.trim());
        q.set("take", "80");
        if (opts?.cursor) q.set("cursor", opts.cursor);
        const r = await fetch(`/api/admin/sms-logs?${q.toString()}`, { cache: "no-store" });
        const j = (await r.json()) as {
          items?: SmsLogRow[];
          nextCursor?: string | null;
          stats?: { total24h: number; failed24h: number };
          error?: string;
        };
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setStats(j.stats ?? { total24h: 0, failed24h: 0 });
        setNextCursor(j.nextCursor ?? null);
        setItems((prev) =>
          opts?.append ? [...prev, ...(j.items ?? [])] : (j.items ?? []),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [statusFilter, sourceFilter, phoneQuery],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="rounded-lg border bg-muted/30 px-4 py-2">
          <span className="text-muted-foreground">近 24h 发码次数 </span>
          <span className="font-semibold tabular-nums">{stats.total24h}</span>
        </div>
        <div className="rounded-lg border bg-muted/30 px-4 py-2">
          <span className="text-muted-foreground">近 24h 失败 </span>
          <span className="font-semibold tabular-nums text-red-600">{stats.failed24h}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">状态</span>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">来源（含 portal:）</span>
          <input
            className="w-40 rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder="book-mall / portal:canvas"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">手机号</span>
          <input
            className="w-36 rounded-md border bg-background px-2 py-1.5 text-sm"
            placeholder="138…"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => setPhoneQuery(phoneInput)}
        >
          查询
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void load()}
        >
          刷新
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">时间</th>
              <th className="px-3 py-2">手机号</th>
              <th className="px-3 py-2">验证码</th>
              <th className="px-3 py-2">用途</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">通道</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">错误</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  {busy ? "加载中…" : "暂无记录"}
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatTime(row.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono">{row.phone}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{row.code ?? "—"}</td>
                    <td className="px-3 py-2">{PURPOSE_LABEL[row.purpose] ?? row.purpose}</td>
                    <td className="px-3 py-2">{row.source}</td>
                    <td className={`px-3 py-2 ${statusClass(row.status)}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.provider ?? "—"}
                      {row.templateId ? ` · ${row.templateId}` : ""}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.sendIp ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-red-600">
                      {row.errorCode ? `${row.errorCode}: ` : ""}
                      {row.errorMessage ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-primary"
                        onClick={() =>
                          setExpandedId((id) => (id === row.id ? null : row.id))
                        }
                      >
                        {expandedId === row.id ? "收起" : "详情"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === row.id ? (
                    <tr className="border-t bg-muted/20">
                      <td colSpan={10} className="px-3 py-3 text-xs">
                        <dl className="grid gap-1 sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">渠道</dt>
                            <dd>{row.channel}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">verificationId</dt>
                            <dd className="font-mono">{row.verificationId ?? "—"}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">User-Agent</dt>
                            <dd className="break-all">{row.userAgent ?? "—"}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">detailJson</dt>
                            <dd>
                              <pre className="mt-1 overflow-x-auto rounded bg-background p-2 font-mono text-[11px]">
                                {row.detailJson
                                  ? JSON.stringify(row.detailJson, null, 2)
                                  : "—"}
                              </pre>
                            </dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nextCursor ? (
        <button
          type="button"
          disabled={busy}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
          onClick={() => void load({ cursor: nextCursor, append: true })}
        >
          加载更多
        </button>
      ) : null}
    </div>
  );
}
