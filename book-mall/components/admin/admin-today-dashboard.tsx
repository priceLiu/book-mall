"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";

import type { CockpitDailyDashboardSnapshot } from "@/lib/admin/platform-cockpit-daily-dashboard";
import { cstBusinessDate } from "@/lib/billing/cst-business-date";

type TabId = "apps" | "projects" | "details";

function fmtInt(n: number) {
  return n.toLocaleString("zh-CN");
}

function fmtYuan(n: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPctRate(rate: number | null) {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function logHighlightHref(gatewayOrigin: string | null, id: string): string {
  if (gatewayOrigin) {
    return `${gatewayOrigin}/dashboard/logs?highlight=${encodeURIComponent(id)}`;
  }
  return "/admin/errors";
}

function logsIndexHref(gatewayOrigin: string | null): string {
  return gatewayOrigin ? `${gatewayOrigin}/dashboard/logs` : "/admin/errors";
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function HeroMetric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "blue" | "green" | "purple" | "slate" | "red";
}) {
  const toneCls =
    tone === "blue"
      ? "border-[#91caff] bg-gradient-to-br from-[#f0f6ff] to-white"
      : tone === "green"
        ? "border-[#b7eb8f] bg-gradient-to-br from-[#f6ffed] to-white"
        : tone === "purple"
          ? "border-[#d3adf7] bg-gradient-to-br from-[#f9f0ff] to-white"
          : tone === "red"
            ? "border-[#ffa39e] bg-gradient-to-br from-[#fff2f0] to-white"
            : "border-[#d1d9e0] bg-gradient-to-br from-[#f6f8fa] to-white";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneCls}`}>
      <p className="text-xs font-medium text-[#656d76]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#1f2328] sm:text-3xl">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-[#656d76]">{sub}</p> : null}
    </div>
  );
}

function DataTable({
  columns,
  rows,
  emptyLabel,
}: {
  columns: { key: string; label: string; align?: "right" }[];
  rows: Record<string, ReactNode>[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#d1d9e0] bg-white px-4 py-12 text-center text-sm text-[#656d76]">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[#d1d9e0] bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-[#f6f8fa] text-left text-xs font-medium text-[#656d76]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2.5 ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d1d9e0]/80">
          {rows.map((row, i) => (
            <tr key={i} className="text-[#1f2328]">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2.5 tabular-nums ${c.align === "right" ? "text-right" : ""}`}
                >
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TAB_LABELS: Record<TabId, string> = {
  apps: "按应用",
  projects: "按项目 Top 20",
  details: "费用明细",
};

export function AdminTodayDashboard({
  initialDaily,
  gatewayOrigin,
  embedInCockpit = false,
}: {
  initialDaily: CockpitDailyDashboardSnapshot;
  gatewayOrigin: string | null;
  /** 嵌入 /admin 长页：去掉独立页 sticky 与重复标题 */
  embedInCockpit?: boolean;
}) {
  const [daily, setDaily] = useState(initialDaily);
  const [businessDate, setBusinessDate] = useState(initialDaily.businessDateCst);
  const [tab, setTab] = useState<TabId>("apps");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isToday = businessDate === cstBusinessDate();
  const emptyDayLabel = isToday ? "今日" : "该日";

  const refresh = useCallback(async (nextDate?: string) => {
    const date = nextDate ?? businessDate;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ date, format: "json" });
      const res = await fetch(`/api/admin/platform-cockpit/daily?${qs}`, { cache: "no-store" });
      const body = (await res.json()) as {
        daily?: CockpitDailyDashboardSnapshot;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `加载失败 (${res.status})`);
      if (!body.daily) throw new Error("响应缺少 daily");
      setDaily(body.daily);
      setBusinessDate(body.daily.businessDateCst);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [businessDate]);

  function onDateChange(value: string) {
    setBusinessDate(value);
    void refresh(value);
  }

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ date: businessDate, format: "csv" });
      const res = await fetch(`/api/admin/platform-cockpit/daily?${qs}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `导出失败 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cockpit-daily-${businessDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  const { overview } = daily;

  const appRows = daily.byApp.map((r) => ({
    app: r.appLabel,
    credits: fmtInt(Math.round(r.credits)),
    image: fmtInt(r.imageCount),
    video: fmtInt(r.videoCount),
    gateway: `${fmtInt(r.gatewaySucceeded)} / ${fmtInt(r.gatewayFailed)}`,
    cost: fmtYuan(r.costYuan),
  }));

  const projectRows = daily.byProject.map((r) => ({
    project: <span title={r.projectKey}>{r.projectLabel}</span>,
    app: r.appLabel,
    credits: fmtInt(Math.round(r.credits)),
    image: fmtInt(r.imageCount),
    video: fmtInt(r.videoCount),
    gateway: fmtInt(r.gatewaySucceeded),
    cost: fmtYuan(r.costYuan),
  }));

  const detailRows = daily.details.map((r) => ({
    time: fmtTime(r.submittedAt),
    app: r.appLabel,
    project: (
      <span className="max-w-[12rem] truncate inline-block align-bottom" title={r.projectLabel}>
        {r.projectLabel}
      </span>
    ),
    model: (
      <span className="max-w-[10rem] truncate inline-block align-bottom" title={r.model}>
        {r.model}
      </span>
    ),
    kind: r.mediaKind === "other" ? r.requestKind : r.mediaKind === "image" ? "生图" : "生视频",
    credits: fmtInt(Math.round(r.credits)),
    cost: fmtYuan(r.costYuan),
    log: (
      <Link
        href={logHighlightHref(gatewayOrigin, r.id)}
        className="font-medium text-[#0969da] hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        日志
      </Link>
    ),
  }));

  const toolbarCls = embedInCockpit
    ? "mb-4 rounded-lg border border-[#d1d9e0] bg-[#f6f8fa]/80 px-3 py-3"
    : "sticky top-14 z-30 -mx-4 mb-6 border-b border-[#d1d9e0] bg-[#f6f8fa]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6";

  return (
    <div className={loading ? "pointer-events-none opacity-70" : undefined}>
      <div className={toolbarCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#656d76]">
            数据更新 {fmtTime(daily.generatedAt)} · Gateway 成功日志为统计真源
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[#656d76]">
              <span>业务日</span>
              <input
                type="date"
                value={businessDate}
                disabled={loading || exporting}
                onChange={(e) => onDateChange(e.target.value)}
                className="rounded-md border border-[#d1d9e0] bg-white px-2 py-1.5 text-sm text-[#1f2328] disabled:opacity-60"
              />
            </label>
            {!isToday ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => onDateChange(cstBusinessDate())}
                className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-sm font-medium text-[#0969da] hover:border-[#0969da] disabled:opacity-60"
              >
                回到今日
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading || exporting}
              onClick={() => void refresh()}
              className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-sm font-medium text-[#1f2328] hover:border-[#0969da] disabled:opacity-60"
            >
              {loading ? "刷新中…" : "刷新"}
            </button>
            <button
              type="button"
              disabled={loading || exporting}
              onClick={() => void exportCsv()}
              className="rounded-md bg-[#0969da] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0550ae] disabled:opacity-60"
            >
              {exporting ? "导出中…" : "导出 CSV"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">
          {error}
        </p>
      ) : null}

      {overview.creditReconcileAlert ? (
        <div
          className="mb-4 rounded-md border border-[#ffe58f] bg-[#fffbe6] px-3 py-2 text-sm text-[#874d00]"
          role="status"
        >
          <strong className="font-medium">积分交叉校验：</strong>
          Gateway {fmtInt(Math.round(overview.creditsFromGateway))} · 账本{" "}
          {fmtInt(Math.round(overview.creditsFromLedger))} · 差异{" "}
          {overview.creditsDelta >= 0 ? "+" : ""}
          {fmtInt(Math.round(overview.creditsDelta))}（{fmtPctRate(overview.creditsDeltaRate)}）
          <Link href="/admin/usage-audit" className="ml-2 font-medium text-[#0969da] hover:underline">
            用量审计 →
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <HeroMetric
          label="积分消耗"
          value={fmtInt(Math.round(overview.creditsFromGateway))}
          sub={`账本 ${fmtInt(Math.round(overview.creditsFromLedger))}`}
          tone="blue"
        />
        <HeroMetric
          label="生图成功"
          value={fmtInt(overview.imageSucceeded)}
          sub="IMAGE / TRYON"
          tone="green"
        />
        <HeroMetric
          label="生视频成功"
          value={fmtInt(overview.videoSucceeded)}
          sub="VIDEO"
          tone="purple"
        />
        <HeroMetric
          label="Gateway"
          value={`${fmtInt(overview.gatewaySucceeded)} 成功`}
          sub={`失败 ${fmtInt(overview.gatewayFailed)}${overview.gatewayRunning > 0 ? ` · 在飞 ${fmtInt(overview.gatewayRunning)}` : ""}`}
          tone="slate"
        />
        <HeroMetric
          label="估算厂商成本"
          value={fmtYuan(overview.costYuan)}
          sub={
            overview.costTruncated
              ? `抽样 ${fmtInt(overview.costScanCount)} 条，完整日可能更高`
              : `基于 ${fmtInt(overview.costScanCount)} 条成功日志`
          }
          tone="red"
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-[#d1d9e0]">
        {(Object.keys(TAB_LABELS) as TabId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? "border border-b-0 border-[#d1d9e0] bg-white text-[#0969da]"
                : "text-[#656d76] hover:bg-[#f6f8fa]"
            }`}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1 text-xs text-[#656d76]">
          <Link href="/admin/usage-audit" className="text-[#0969da] hover:underline">
            用量审计
          </Link>
          <span>·</span>
          <Link
            href={logsIndexHref(gatewayOrigin)}
            className="text-[#0969da] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gateway 日志
          </Link>
        </div>
      </div>

      <div className="rounded-b-xl rounded-tr-xl border border-t-0 border-[#d1d9e0] bg-white p-4 sm:p-5">
        {tab === "apps" ? (
          <DataTable
            columns={[
              { key: "app", label: "应用" },
              { key: "credits", label: "积分", align: "right" },
              { key: "image", label: "生图", align: "right" },
              { key: "video", label: "生视频", align: "right" },
              { key: "gateway", label: "成功 / 失败", align: "right" },
              { key: "cost", label: "成本（元）", align: "right" },
            ]}
            rows={appRows}
            emptyLabel={`${emptyDayLabel}尚无 Gateway 调用，可切换业务日或稍后再看`}
          />
        ) : null}
        {tab === "projects" ? (
          <DataTable
            columns={[
              { key: "project", label: "项目" },
              { key: "app", label: "应用" },
              { key: "credits", label: "积分", align: "right" },
              { key: "image", label: "生图", align: "right" },
              { key: "video", label: "生视频", align: "right" },
              { key: "gateway", label: "Gateway 成功", align: "right" },
              { key: "cost", label: "成本（元）", align: "right" },
            ]}
            rows={projectRows}
            emptyLabel={`${emptyDayLabel}尚无按项目可归类的调用`}
          />
        ) : null}
        {tab === "details" ? (
          <>
            <p className="mb-3 text-xs text-[#656d76]">最近 100 条成功调用（按提交时间倒序）</p>
            <DataTable
              columns={[
                { key: "time", label: "时间" },
                { key: "app", label: "应用" },
                { key: "project", label: "项目" },
                { key: "model", label: "模型" },
                { key: "kind", label: "类型" },
                { key: "credits", label: "积分", align: "right" },
                { key: "cost", label: "成本", align: "right" },
                { key: "log", label: "" },
              ]}
              rows={detailRows}
              emptyLabel={`${emptyDayLabel}尚无成功调用明细`}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated 使用 AdminTodayDashboard；保留导出名兼容旧引用 */
export const AdminPlatformCockpitDailyPanel = AdminTodayDashboard;
