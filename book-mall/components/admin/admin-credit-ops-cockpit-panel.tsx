import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";

import type { CreditOpsDashboardSnapshot } from "@/lib/billing/credit-ops-service";
import type { CreditOpsAlert } from "@/lib/billing/credit-ops-alerts";

const HEALTH_META = {
  healthy: {
    label: "运行正常",
    sub: "无待办、无逾期，定时任务已覆盖今日",
    icon: ShieldCheck,
    ring: "from-emerald-400 to-teal-500",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  },
  warn: {
    label: "需关注",
    sub: "存在对账偏差或配置提醒，建议进入控制台核查",
    icon: AlertTriangle,
    ring: "from-amber-400 to-orange-500",
    badge: "bg-amber-500/20 text-amber-100 border-amber-400/30",
  },
  critical: {
    label: "需立即处理",
    sub: "有逾期工单或任务失败，请尽快补跑",
    icon: ShieldAlert,
    ring: "from-rose-500 to-red-600",
    badge: "bg-rose-500/25 text-rose-100 border-rose-400/40",
  },
  offline: {
    label: "模块未加载",
    sub: "Prisma 未含 CreditOps 模型，请迁移并重启 dev:all",
    icon: ShieldAlert,
    ring: "from-slate-500 to-slate-600",
    badge: "bg-white/10 text-slate-200 border-white/20",
  },
} as const;

function fmt(n: number) {
  return n.toLocaleString("zh-CN");
}

function jobTypeLabel(t: string) {
  if (t === "DAILY_EXPIRE_SWEEP") return "批次到期清扫";
  if (t === "DAILY_SUBSCRIPTION_RESET") return "订阅积分刷新";
  return t;
}

function OpsStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "danger" | "ok" | "muted";
}) {
  const valueClass =
    accent === "danger"
      ? "text-rose-300"
      : accent === "ok"
        ? "text-emerald-300"
        : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.07]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-200/70">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-snug text-indigo-100/60">{hint}</p> : null}
    </div>
  );
}

export function AdminCreditOpsCockpitPanel({
  dashboard,
  alerts,
}: {
  dashboard: CreditOpsDashboardSnapshot;
  alerts: CreditOpsAlert[];
}) {
  const health = HEALTH_META[dashboard.opsHealth];
  const HealthIcon = health.icon;
  const recentJobs = dashboard.lastJobs.slice(0, 2);

  const statusNote =
    dashboard.opsHealth === "offline"
      ? "当前显示全 0 是因为运维模块未加载，不是业务真的没问题。"
      : dashboard.overdue === 0 && dashboard.pending === 0
        ? dashboard.processedToday > 0
          ? `今日已处理 ${fmt(dashboard.processedToday)} 条（含补跑 ${fmt(dashboard.backfilledToday)}），历史逾期已清；待办为 0 属正常。`
          : "今日尚无新工单，也无历史逾期；全 0 表示队列空闲。"
        : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] p-6 text-white shadow-xl shadow-indigo-950/30 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${health.ring} p-[2px] shadow-lg shadow-black/30`}
          >
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#0f172a]/90">
              <HealthIcon className="h-7 w-7 text-white" strokeWidth={1.75} />
            </div>
            {dashboard.opsHealth === "healthy" ? (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#0f172a]">
                <Sparkles className="h-3 w-3 text-white" />
              </span>
            ) : null}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                积分运维驾驶舱
              </h2>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${health.badge}`}
              >
                {health.label}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-sm text-indigo-100/75">{health.sub}</p>
            <p className="mt-2 text-xs text-indigo-200/50">
              业务日 {dashboard.date}（CST）· 累计完成 {fmt(dashboard.totalDone)} 条工单
            </p>
          </div>
        </div>

        <Link
          href="/admin/finance/credit-expiry-ops"
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
        >
          积分清零控制台
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {alerts.length > 0 ? (
        <ul className="relative mt-5 space-y-2">
          {alerts.slice(0, 3).map((a) => (
            <li
              key={a.code + a.message}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                a.level === "CRITICAL"
                  ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                  : "border-amber-400/25 bg-amber-500/10 text-amber-50"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{a.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {statusNote ? (
        <p className="relative mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-indigo-100/80">
          {statusNote}
        </p>
      ) : null}

      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <OpsStat
          label="待处理"
          value={fmt(dashboard.pending)}
          hint="今日到期、尚未执行"
          accent={dashboard.pending > 0 ? "danger" : "muted"}
        />
        <OpsStat
          label="逾期未处理"
          value={fmt(dashboard.overdue)}
          hint="历史漏跑，需补跑"
          accent={dashboard.overdue > 0 ? "danger" : "muted"}
        />
        <OpsStat
          label="今日已处理"
          value={fmt(dashboard.processedToday)}
          hint={`含补跑 ${fmt(dashboard.backfilledToday)} 条`}
          accent={dashboard.processedToday > 0 ? "ok" : "muted"}
        />
        <OpsStat
          label="对账偏差"
          value={fmt(dashboard.driftCount)}
          hint="DONE 但 resultJson.drift"
          accent={dashboard.driftCount > 0 ? "danger" : "muted"}
        />
        <OpsStat
          label="过期未清批次"
          value={fmt(dashboard.staleSubscriptionLotAccounts)}
          hint="订阅批次应清未清账户数"
          accent={dashboard.staleSubscriptionLotAccounts > 0 ? "danger" : "muted"}
        />
        <OpsStat
          label="今日失败"
          value={fmt(dashboard.failedToday)}
          accent={dashboard.failedToday > 0 ? "danger" : "muted"}
        />
      </div>

      <div className="relative mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-indigo-100">
            <Timer className="h-4 w-4 text-violet-300" />
            最近任务执行
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-indigo-200/60">
              尚无执行记录。请配置 CloudBase Cron，或在控制台手动执行。
            </p>
          ) : (
            <ul className="space-y-3">
              {recentJobs.map((job) => {
                const stats = job.statsJson as { done?: number; total?: number } | null;
                return (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{jobTypeLabel(job.jobType)}</p>
                      <p className="mt-0.5 text-xs text-indigo-200/60">
                        {new Date(job.startedAt).toLocaleString("zh-CN")} · {job.trigger} ·{" "}
                        {job.status}
                        {stats?.total != null
                          ? ` · ${stats.done ?? 0}/${stats.total}`
                          : null}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        job.status === "SUCCESS"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : job.status === "PARTIAL"
                            ? "bg-amber-500/20 text-amber-100"
                            : "bg-rose-500/20 text-rose-100"
                      }`}
                    >
                      {job.status === "SUCCESS" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {job.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-indigo-100">
            <Zap className="h-4 w-4 text-cyan-300" />
            自动化状态
          </div>
          <ul className="space-y-2 text-sm text-indigo-100/85">
            <li className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-indigo-300" />
                批次到期 Cron（00:15 CST）
              </span>
              <CronBadge ok={dashboard.cronRanToday.expire} manualRan={!!dashboard.lastJobs.find(
                (j) => j.jobType === "DAILY_EXPIRE_SWEEP" && j.scheduledDate === dashboard.date,
              )} />
            </li>
            <li className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-indigo-300" />
                订阅刷新 Cron（00:30 CST）
              </span>
              <CronBadge ok={dashboard.cronRanToday.reset} manualRan={!!dashboard.lastJobs.find(
                (j) =>
                  j.jobType === "DAILY_SUBSCRIPTION_RESET" && j.scheduledDate === dashboard.date,
              )} />
            </li>
          </ul>
          {!dashboard.cronRanToday.expire || !dashboard.cronRanToday.reset ? (
            <p className="mt-3 text-xs leading-relaxed text-indigo-200/55">
              今日任务可能由脚本/手动触发（SCRIPT）。生产环境请在 CloudBase 配置 Cron，避免依赖人工。
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CronBadge({ ok, manualRan }: { ok: boolean; manualRan: boolean }) {
  if (ok) {
    return (
      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">
        Cron 已跑
      </span>
    );
  }
  if (manualRan) {
    return (
      <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-200">
        手动/脚本
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-indigo-200/70">
      未执行
    </span>
  );
}
