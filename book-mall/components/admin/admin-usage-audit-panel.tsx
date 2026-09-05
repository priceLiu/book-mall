"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { UsageAuditAppRow, UsageAuditSnapshot } from "@/lib/admin/platform-cockpit-usage-audit";
import { cstBusinessDate } from "@/lib/billing/cst-business-date";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const inputCls =
  "rounded border border-[#d1d9e0] px-2 py-1.5 text-sm focus:border-[#0969da] focus:outline-none";

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

function statusClass(status: UsageAuditAppRow["status"]): string {
  switch (status) {
    case "OK":
      return "bg-[#f6ffed] text-[#389e0d]";
    case "MISSING_GATEWAY":
      return "bg-[#fff1f0] text-[#cf1322]";
    case "ORPHAN_GATEWAY":
      return "bg-[#fff7e6] text-[#d46b08]";
    case "GATEWAY_ONLY":
      return "bg-[#fafafa] text-[#8c8c8c]";
    default:
      return "bg-[#fafafa] text-[#595959]";
  }
}

function statusLabel(status: UsageAuditAppRow["status"]): string {
  switch (status) {
    case "OK":
      return "OK";
    case "MISSING_GATEWAY":
      return "Gateway 偏少";
    case "ORPHAN_GATEWAY":
      return "无业务信号";
    case "GATEWAY_ONLY":
      return "仅 Gateway";
    default:
      return status;
  }
}

function AuditTable({ rows }: { rows: UsageAuditAppRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#d1d9e0]/80">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-[#fafafa] text-left text-xs text-[#656d76]">
            <th className="px-3 py-2">应用</th>
            <th className="px-3 py-2 text-right">平台审计</th>
            <th className="px-3 py-2 text-right">Gateway</th>
            <th className="px-3 py-2 text-right">差值</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2">平台审计源</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.appKey}
              className={`border-b last:border-0 ${r.status === "MISSING_GATEWAY" ? "bg-[#fff1f0]/40" : ""}`}
            >
              <td className="px-3 py-2 font-medium">{r.appLabel}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.auditSource ? r.platformCount.toLocaleString("zh-CN") : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.gatewayCount.toLocaleString("zh-CN")}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${r.diff > 0 ? "font-medium text-[#cf1322]" : ""}`}
              >
                {r.auditSource ? (r.diff > 0 ? `+${r.diff}` : r.diff) : "—"}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-xs ${statusClass(r.status)}`}
                >
                  {statusLabel(r.status)}
                </span>
              </td>
              <td
                className="max-w-[200px] truncate px-3 py-2 text-xs text-[#656d76]"
                title={r.auditSource ?? undefined}
              >
                {r.auditSource ?? "暂无 · 仅展示 Gateway"}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-[#8c959f]">
                所选日期范围内暂无用量
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

type Preset = "today" | "last7" | "month";

function presetRange(preset: Preset): { from: string; to: string } {
  const today = cstBusinessDate(new Date());
  if (preset === "today") return { from: today, to: today };
  if (preset === "last7") return { from: defaultFromDate(), to: today };
  const m = today.slice(0, 7) + "-01";
  return { from: m, to: today };
}

export function AdminUsageAuditPanel({
  variant = "page",
}: {
  /** page：独立页；cockpit：驾驶舱嵌入 */
  variant?: "page" | "cockpit";
}) {
  const today = cstBusinessDate(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [preset, setPreset] = useState<Preset>("today");
  const [data, setData] = useState<UsageAuditSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/usage-audit?${qs}`, { cache: "no-store" });
      const j = (await res.json()) as UsageAuditSnapshot & { error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {variant === "page" ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-[#656d76]">
                用量管理
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1f2328]">用量审计对比</h1>
            </>
          ) : (
            <h2 className="text-lg font-semibold text-[#1f2328]">用量对比 · 审计监督</h2>
          )}
          <p className="mt-0.5 text-sm text-[#656d76]">
            平台业务线（审查）vs Gateway 技术线（财务真源）。凡大模型调用须经 Gateway，严重偏离时需排查直连或漏记。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {variant === "cockpit" ? (
            <Link
              href="/admin/usage-audit"
              className="font-medium text-[#0969da] underline-offset-4 hover:underline"
            >
              用量管理 · 完整页 →
            </Link>
          ) : (
            <Link
              href="/admin/finance/usage-management"
              className="font-medium text-[#0969da] underline-offset-4 hover:underline"
            >
              Finance 用量对账中心 →
            </Link>
          )}
        </div>
      </div>

      <Card className="border-[#d1d9e0]/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">日期范围</CardTitle>
          <CardDescription>CST 日历日；平台审计与 Gateway 均按所选区间统计</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["today", "今日"],
                ["last7", "近 7 日"],
                ["month", "本月"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className={`rounded px-3 py-1.5 text-sm ${
                  preset === id
                    ? "bg-[#0969da] text-white"
                    : "border border-[#d1d9e0] bg-white hover:bg-[#f6f8fa]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-[#656d76]">起始日</span>
              <input
                type="date"
                className={`${inputCls} mt-1 block`}
                value={from}
                onChange={(e) => {
                  setPreset("today");
                  setFrom(e.target.value);
                }}
              />
            </label>
            <label className="text-sm">
              <span className="text-[#656d76]">结束日</span>
              <input
                type="date"
                className={`${inputCls} mt-1 block`}
                value={to}
                onChange={(e) => {
                  setPreset("today");
                  setTo(e.target.value);
                }}
              />
            </label>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded bg-[#0969da] px-3 py-1.5 text-sm text-white hover:bg-[#0550ae] disabled:opacity-50"
            >
              {loading ? "加载中…" : "查询"}
            </button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">
          {error}
        </div>
      ) : null}

      {data && data.alertCount > 0 ? (
        <div className="rounded-md border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">
          {data.from === data.to ? data.from : `${data.from} ~ ${data.to}`} 内有 {data.alertCount}{" "}
          项审计告警，请核对是否 bypass Gateway。
        </div>
      ) : null}

      <Card className="border-[#d1d9e0]/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {data
              ? data.from === data.to
                ? `${data.from}（CST）`
                : `${data.from} ~ ${data.to}`
              : "用量对比"}
          </CardTitle>
          <CardDescription>按应用 · 平台审计 vs Gateway 成功次数</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="py-8 text-center text-sm text-[#656d76]">加载用量对比…</p>
          ) : data ? (
            <AuditTable rows={data.rows} />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
