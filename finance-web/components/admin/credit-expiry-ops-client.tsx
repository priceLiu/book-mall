"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type Alert = { code: string; level: string; message: string; value?: number };

type Dashboard = {
  date: string;
  prismaReady?: boolean;
  opsHealth?: string;
  pending: number;
  overdue: number;
  doneToday: number;
  processedToday?: number;
  backfilledToday?: number;
  totalDone?: number;
  skippedToday: number;
  failedToday: number;
  driftCount?: number;
  staleSubscriptionLotAccounts?: number;
  lastJobs: Array<{
    id: string;
    jobType: string;
    scheduledDate: string;
    trigger: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    statsJson: unknown;
    errorSummary: string | null;
  }>;
};

type WorkItem = {
  id: string;
  workType: string;
  dueDate: string;
  dueAt: string;
  ownerHint: string | null;
  pool: string;
  source: string | null;
  expectedExpireCredits: number;
  expectedGrantCredits: number;
  status: string;
  processedAt: string | null;
  isBackfill: boolean;
  errorMessage: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-[#8c8c8c]",
  OVERDUE: "text-[#cf1322] font-medium",
  RUNNING: "text-[#1890ff]",
  DONE: "text-[#389e0d]",
  SKIPPED: "text-[#d48806]",
  FAILED: "text-[#cf1322]",
};

const LEVEL: Record<string, string> = {
  WARN: "bg-[#fff7e6] text-[#d48806]",
  CRITICAL: "bg-[#fff1f0] text-[#cf1322]",
};

function workTypeLabel(t: string) {
  return t === "SUBSCRIPTION_RESET" ? "订阅刷新" : "批次到期";
}

export function CreditExpiryOpsClient() {
  const base = useBookMallBaseUrl();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setError(null);
    const [dashR, itemsR] = await Promise.all([
      financeApiFetch<{ dashboard: Dashboard; alerts: Alert[] }>(
        base,
        "/api/finance/admin/credit-expiry-ops",
      ),
      financeApiFetch<{ items: WorkItem[]; total: number }>(
        base,
        `/api/finance/admin/credit-expiry-ops?view=work-items&take=100${statusFilter ? `&status=${statusFilter}` : ""}`,
      ),
    ]);
    if (!dashR.ok) {
      setError(dashR.error);
      return;
    }
    setDashboard(dashR.data.dashboard);
    setAlerts(dashR.data.alerts);
    if (itemsR.ok) {
      setItems(itemsR.data.items);
      setTotal(itemsR.data.total);
    }
  }, [base, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(
    mode: "preview" | "run-today" | "backfill-overdue",
    phase: "expire" | "reset" | "all" = "all",
  ) {
    if (!base) return;
    setBusy(mode);
    setMessage(null);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(
      base,
      "/api/finance/admin/credit-expiry-ops",
      { mode, phase, generateFirst: true },
    );
    setBusy(null);
    if (!r.ok) {
      setMessage(r.error);
      return;
    }
    setMessage(
      mode === "preview"
        ? "预览完成（未写入），请查看工单列表。"
        : mode === "backfill-overdue"
          ? "逾期补跑已提交。"
          : "今日任务已执行。",
    );
    await load();
  }

  async function backfillItem(id: string) {
    if (!base) return;
    setBusy(id);
    const r = await financeApiPost(base, "/api/finance/admin/credit-expiry-ops", {
      mode: "backfill-items",
      workItemIds: [id],
      phase: "all",
    });
    setBusy(null);
    if (!r.ok) {
      setMessage(r.error);
      return;
    }
    setMessage("已补跑所选账户。");
    await load();
  }

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!dashboard) return <FinancePageState>加载中…</FinancePageState>;

  return (
    <FinancePageShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">积分清零运维台</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            业务日 {dashboard.date}（CST）· 规则见 docs/积分清零控制台.md
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            className="rounded border border-[#d9d9d9] bg-white px-3 py-1.5 text-sm hover:border-[#1890ff]"
            onClick={() => runAction("preview")}
          >
            预览今日
          </button>
          <button
            type="button"
            disabled={!!busy}
            className="rounded border border-[#1890ff] bg-[#1890ff] px-3 py-1.5 text-sm text-white hover:bg-[#096dd9]"
            onClick={() => runAction("run-today")}
          >
            执行今日任务
          </button>
          <button
            type="button"
            disabled={!!busy || dashboard.overdue === 0}
            className="rounded border border-[#ff4d4f] bg-[#ff4d4f] px-3 py-1.5 text-sm text-white hover:bg-[#cf1322] disabled:opacity-50"
            onClick={() => runAction("backfill-overdue")}
          >
            补跑全部逾期 ({dashboard.overdue})
          </button>
        </div>
      </header>

      {message ? (
        <p className="rounded border border-[#b7eb8f] bg-[#f6ffed] px-3 py-2 text-sm text-[#389e0d]">
          {message}
        </p>
      ) : null}

      {alerts.length > 0 ? (
        <section className="rounded border border-[#ffccc7] bg-[#fff1f0] p-4">
          <h2 className="mb-2 text-sm font-medium text-[#cf1322]">预警（{alerts.length}）</h2>
          <ul className="space-y-1 text-sm">
            {alerts.map((a) => (
              <li key={a.code + a.message} className="flex items-center justify-between gap-2">
                <span>{a.message}</span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${LEVEL[a.level] ?? ""}`}>
                  {a.level}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="待处理" value={dashboard.pending} />
        <StatCard label="逾期" value={dashboard.overdue} danger={dashboard.overdue > 0} />
        <StatCard
          label="今日已处理"
          value={dashboard.processedToday ?? dashboard.doneToday}
          hint={
            dashboard.backfilledToday
              ? `含补跑 ${dashboard.backfilledToday}`
              : undefined
          }
        />
        <StatCard label="累计完成" value={dashboard.totalDone ?? "—"} />
        <StatCard
          label="对账偏差"
          value={dashboard.driftCount ?? 0}
          danger={(dashboard.driftCount ?? 0) > 0}
        />
        <StatCard label="失败" value={dashboard.failedToday} danger={dashboard.failedToday > 0} />
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">工单列表（{total}）</h2>
          <select
            className="rounded border border-[#d9d9d9] px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="PENDING">PENDING</option>
            <option value="OVERDUE">OVERDUE</option>
            <option value="DONE">DONE</option>
            <option value="SKIPPED">SKIPPED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-[#f0f0f0] text-left text-[#8c8c8c]">
                <th className="px-2 py-2">账户</th>
                <th className="px-2 py-2">类型</th>
                <th className="px-2 py-2">池</th>
                <th className="px-2 py-2">应清/应发</th>
                <th className="px-2 py-2">到期日</th>
                <th className="px-2 py-2">状态</th>
                <th className="px-2 py-2">处理时间</th>
                <th className="px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-[#8c8c8c]">
                    暂无工单。可点击「预览今日」生成。
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-[#fafafa]">
                    <td className="px-2 py-2">{row.ownerHint ?? "—"}</td>
                    <td className="px-2 py-2">{workTypeLabel(row.workType)}</td>
                    <td className="px-2 py-2">{row.pool}</td>
                    <td className="px-2 py-2">
                      {row.expectedExpireCredits > 0
                        ? `清 ${row.expectedExpireCredits}`
                        : `发 ${row.expectedGrantCredits}`}
                    </td>
                    <td className="px-2 py-2">{row.dueDate}</td>
                    <td className={`px-2 py-2 ${STATUS_COLOR[row.status] ?? ""}`}>
                      {row.status}
                      {row.isBackfill ? " ·补跑" : ""}
                    </td>
                    <td className="px-2 py-2 text-xs text-[#8c8c8c]">
                      {row.processedAt ? new Date(row.processedAt).toLocaleString("zh-CN") : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {(row.status === "OVERDUE" || row.status === "PENDING" || row.status === "FAILED") && (
                        <button
                          type="button"
                          disabled={busy === row.id}
                          className="text-[#1890ff] hover:underline disabled:opacity-50"
                          onClick={() => backfillItem(row.id)}
                        >
                          补跑
                        </button>
                      )}
                      {row.errorMessage ? (
                        <span className="ml-2 text-xs text-[#cf1322]" title={row.errorMessage}>
                          !
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">最近执行</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f0f0f0] text-left text-[#8c8c8c]">
              <th className="px-2 py-2">类型</th>
              <th className="px-2 py-2">业务日</th>
              <th className="px-2 py-2">触发</th>
              <th className="px-2 py-2">状态</th>
              <th className="px-2 py-2">开始</th>
              <th className="px-2 py-2">统计</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.lastJobs.map((j) => (
              <tr key={j.id} className="border-b border-[#fafafa]">
                <td className="px-2 py-2">{j.jobType}</td>
                <td className="px-2 py-2">{j.scheduledDate}</td>
                <td className="px-2 py-2">{j.trigger}</td>
                <td className="px-2 py-2">{j.status}</td>
                <td className="px-2 py-2 text-xs">
                  {new Date(j.startedAt).toLocaleString("zh-CN")}
                </td>
                <td className="px-2 py-2 text-xs text-[#8c8c8c]">
                  {j.statsJson ? JSON.stringify(j.statsJson) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </FinancePageShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: number | string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded border border-[#e8e8e8] bg-white p-4">
      <div className="text-xs text-[#8c8c8c]">{label}</div>
      <div className={`mt-1 text-2xl font-medium ${danger ? "text-[#cf1322]" : "text-[#262626]"}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[#8c8c8c]">{hint}</div> : null}
    </div>
  );
}
