"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import type {
  GatewayHealthAlert,
  GatewayHealthAlertLevel,
  GatewayHealthSnapshot,
} from "@/lib/gateway/gateway-health-alerts";

const HEALTH_META = {
  healthy: {
    label: "运行正常",
    sub: "无阻塞任务；10 分钟巡检 + 一键修复可用",
    icon: ShieldCheck,
    ring: "from-emerald-400 to-teal-500",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  },
  warn: {
    label: "需关注",
    sub: "存在偏长任务或排队卡住，建议检测后按需修复",
    icon: AlertTriangle,
    ring: "from-amber-400 to-orange-500",
    badge: "bg-amber-500/20 text-amber-100 border-amber-400/30",
  },
  critical: {
    label: "需立即处理",
    sub: "有漏收口的流式 Chat 或视频硬超时，可一键安全修复",
    icon: ShieldAlert,
    ring: "from-rose-500 to-red-600",
    badge: "bg-rose-500/25 text-rose-100 border-rose-400/40",
  },
} as const;

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function alertTone(level: GatewayHealthAlertLevel): string {
  if (level === "CRITICAL") return "border-rose-400/40 bg-rose-500/15 text-rose-50";
  if (level === "WARN") return "border-amber-400/40 bg-amber-500/10 text-amber-50";
  return "border-white/15 bg-white/5 text-indigo-50";
}

function logHref(gatewayOrigin: string | null, id: string): string {
  const q = encodeURIComponent(id);
  if (gatewayOrigin) return `${gatewayOrigin}/dashboard/logs?q=${q}`;
  return `/admin/errors`;
}

type ApiPayload = {
  snapshot: GatewayHealthSnapshot;
  history?: GatewayHealthSnapshot[];
  gatewayOrigin?: string | null;
  error?: string;
};

export function AdminGatewayHealthPanel({
  initial,
  gatewayOrigin: initialOrigin,
  compact,
}: {
  initial: GatewayHealthSnapshot;
  gatewayOrigin?: string | null;
  compact?: boolean;
}) {
  const [snap, setSnap] = useState(initial);
  const [origin, setOrigin] = useState(initialOrigin ?? null);
  const [history, setHistory] = useState<GatewayHealthSnapshot[]>([]);
  const [busy, setBusy] = useState<"scan" | "heal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: "scan" | "heal") => {
    setBusy(action);
    setError(null);
    try {
      const r = await fetch("/api/admin/gateway/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await r.json()) as ApiPayload;
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setSnap(j.snapshot);
      setHistory(j.history ?? []);
      if (j.gatewayOrigin !== undefined) setOrigin(j.gatewayOrigin);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const health = HEALTH_META[snap.opsHealth];
  const HealthIcon = health.icon;
  const healSummary = snap.lastHeal;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#1b1f3b] bg-gradient-to-br from-[#12162c] via-[#1a1440] to-[#0d1117] text-white shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${health.ring} p-[2px]`}
          >
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#12162c]">
              <HealthIcon className="h-6 w-6" />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-200/70">
              Gateway 阻塞预警
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">通道健康</h2>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${health.badge}`}
              >
                {health.label}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-sm text-indigo-100/75">{health.sub}</p>
            <p className="mt-1 text-xs text-indigo-200/55">
              最近检测 {fmtTime(snap.scannedAt)}
              {snap.lastHealAt ? ` · 最近修复 ${fmtTime(snap.lastHealAt)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run("scan")}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy === "scan" ? "animate-spin" : ""}`} />
            {busy === "scan" ? "检测中…" : "立即检测"}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run("heal")}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0969da] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0550ae] disabled:opacity-50"
          >
            <Wrench className={`h-3.5 w-3.5 ${busy === "heal" ? "animate-pulse" : ""}`} />
            {busy === "heal" ? "修复中…" : "一键修复"}
          </button>
          {compact ? (
            <Link
              href="/admin/gateway/health"
              className="inline-flex items-center rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              详情 →
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="px-5 pb-3 text-sm text-rose-300 sm:px-6">{error}</p>
      ) : null}

      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <Stat label="Chat 漏收口 ≥15min" value={snap.counts.staleChat} danger={snap.counts.staleChat > 0} />
        <Stat label="Chat 偏长 10–15min" value={snap.counts.chatLong} />
        <Stat label="视频偏长 / 硬超时" value={`${snap.counts.staleVideo} / ${snap.counts.videoHard}`} danger={snap.counts.videoHard > 0} />
        <Stat label="在飞总数" value={snap.counts.inflight} />
      </div>

      {snap.alerts.length > 0 ? (
        <ul className="space-y-2 px-5 pb-5 sm:px-6">
          {snap.alerts.map((a) => (
            <AlertRow key={a.code} alert={a} />
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-5 text-sm text-indigo-100/60 sm:px-6">
          当前没有需要处理的阻塞。CHAT 超过 15 分钟会自动收口；本巡检每 10 分钟再扫一遍。
        </p>
      )}

      {healSummary && !compact ? (
        <p className="border-t border-white/10 px-5 py-3 text-xs text-indigo-200/70 sm:px-6">
          上次修复：关闭 Chat {healSummary.staleChatClosed} · expire {healSummary.expired} ·
          画布重排 {healSummary.canvasRecovered}
          {healSummary.statsReconciled ? " · 在飞计数已纠偏" : ""}
        </p>
      ) : null}

      {!compact ? (
        <SampleTables snap={snap} origin={origin} />
      ) : null}

      {!compact && history.length > 0 ? (
        <div className="border-t border-white/10 px-5 py-4 sm:px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-indigo-200/70">
            本进程最近扫描
          </p>
          <ul className="space-y-1 text-xs text-indigo-100/70">
            {history.slice(0, 10).map((h, i) => (
              <li key={`${h.scannedAt}-${i}`}>
                {fmtTime(h.scannedAt)} · {HEALTH_META[h.opsHealth].label} · {h.source} ·
                Chat 僵尸 {h.counts.staleChat} · 在飞 {h.counts.inflight}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number | string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wider text-indigo-200/70">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${danger ? "text-rose-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function AlertRow({ alert }: { alert: GatewayHealthAlert }) {
  return (
    <li className={`rounded-lg border px-3 py-2 text-sm ${alertTone(alert.level)}`}>
      <span className="mr-2 text-[10px] font-semibold uppercase">{alert.level}</span>
      {alert.message}
    </li>
  );
}

function SampleTables({
  snap,
  origin,
}: {
  snap: GatewayHealthSnapshot;
  origin: string | null;
}) {
  const groups = [
    { title: "Chat 漏收口抽样", rows: snap.samples.staleChat },
    { title: "视频偏长抽样", rows: snap.samples.staleVideo },
    { title: "异步超时抽样", rows: snap.samples.staleAsync },
  ].filter((g) => g.rows.length > 0);
  if (groups.length === 0) return null;
  return (
    <div className="space-y-4 border-t border-white/10 px-5 py-4 sm:px-6">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-indigo-200/70">
            {g.title}
          </p>
          <ul className="space-y-1 font-mono text-xs text-indigo-100/80">
            {g.rows.map((row) => (
              <li key={row.id}>
                <a
                  href={logHref(origin, row.id)}
                  target={origin ? "_blank" : undefined}
                  rel={origin ? "noreferrer" : undefined}
                  className="text-[#79c0ff] hover:underline"
                >
                  {row.id}
                </a>
                <span className="text-indigo-200/50">
                  {" "}
                  · {row.model} · {row.ageSec}s
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
