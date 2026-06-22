"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Play, RefreshCw, Square } from "lucide-react";

type Verdict = "pass" | "fail" | "pending";

type TaskTiming = {
  durationMs: number | null;
  queueMs: number | null;
  generateMs: number | null;
  vendorPostProcessMs: number | null;
  pollDelayMs: number | null;
  pollDelayOverLimit: boolean;
  sumDeltaMs: number | null;
};

type TaskSnapshot = {
  id: string;
  nodeId: string;
  status: string;
  kieTaskId: string | null;
  gatewayLogId: string | null;
  gatewayStatus: string | null;
  failCode: string | null;
  failMessage: string | null;
  pollCount: number;
  ossUrl: string | null;
  timing: TaskTiming;
};

type Verdicts = {
  run: { verdict: Verdict; detail: string };
  blocking: { verdict: Verdict; detail: string };
  release: { verdict: Verdict; detail: string };
  timing: { verdict: Verdict; detail: string };
};

type Status = {
  ok: boolean;
  projectId: string;
  fetchedAt: string;
  trafficControlEnabled: boolean;
  maxConcurrency: number;
  scopeKey: string;
  runningVideoCount: number;
  dispatchTokens: number | null;
  counts: Record<string, number>;
  total: number;
  terminalCount: number;
  inflightCount: number;
  tasks: TaskSnapshot[];
  verdicts: Verdicts;
  error?: string;
};

type StartResult = {
  ok: boolean;
  projectId: string;
  projectName: string;
  userId: string;
  credentialAlias: string;
  userSource: string;
  count: number;
  durationSec: number;
  modelKey: string;
  imageUrl: string;
  trafficControlEnabled: boolean;
  maxConcurrency: number;
  scopeKey: string;
  taskIds: string[];
  error?: string;
};

function ms(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v < 1000) return `${Math.round(v)}ms`;
  return `${(v / 1000).toFixed(1)}s`;
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "排队中",
  DISPATCHING: "出队中",
  PENDING: "待提交",
  SUBMITTED: "生成中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
};

function statusColor(s: string): string {
  switch (s) {
    case "SUCCEEDED":
      return "text-emerald-300";
    case "FAILED":
      return "text-red-300";
    case "CANCELLED":
      return "text-zinc-400";
    case "SUBMITTED":
    case "DISPATCHING":
      return "text-violet-300";
    case "QUEUED":
      return "text-amber-300";
    default:
      return "text-zinc-300";
  }
}

function VerdictPill({ v }: { v: Verdict }) {
  const map: Record<Verdict, { t: string; c: string }> = {
    pass: { t: "通过", c: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    fail: { t: "未通过", c: "bg-red-500/15 text-red-300 border-red-500/30" },
    pending: { t: "进行中", c: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  };
  const m = map[v];
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${m.c}`}>
      {m.t}
    </span>
  );
}

function VerdictCard({
  title,
  q,
  data,
}: {
  title: string;
  q: string;
  data: { verdict: Verdict; detail: string } | undefined;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-200">
          <span className="mr-1.5 text-zinc-500">{q}</span>
          {title}
        </p>
        {data ? <VerdictPill v={data.verdict} /> : <VerdictPill v="pending" />}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
        {data?.detail ?? "—"}
      </p>
    </div>
  );
}

export function I2vLoadTestClient() {
  const [count, setCount] = useState(10);
  const [durationSec, setDurationSec] = useState(15);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [userId, setUserId] = useState("");

  const [starting, setStarting] = useState(false);
  const [startInfo, setStartInfo] = useState<StartResult | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [auto, setAuto] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 跨轮询累计峰值，用于 Q2/Q3 判定
  const [peakRunning, setPeakRunning] = useState(0);
  const [peakQueued, setPeakQueued] = useState(0);
  const [oversubscribed, setOversubscribed] = useState(false);
  const projectIdRef = useRef<string | null>(null);

  const applyStatus = useCallback((s: Status) => {
    setStatus(s);
    const queued = (s.counts.QUEUED ?? 0) + (s.counts.DISPATCHING ?? 0);
    setPeakRunning((p) => Math.max(p, s.runningVideoCount));
    setPeakQueued((p) => Math.max(p, queued));
    if (s.runningVideoCount > s.maxConcurrency) setOversubscribed(true);
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    setStatus(null);
    setStartInfo(null);
    setPeakRunning(0);
    setPeakQueued(0);
    setOversubscribed(false);
    try {
      const r = await fetch("/api/dev/canvas/i2v-load-test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          durationSec,
          resolution,
          generateAudio,
          userId: userId.trim() || undefined,
        }),
      });
      const data = (await r.json()) as StartResult;
      if (!r.ok || !data.ok) throw new Error(data.error ?? `start_failed_${r.status}`);
      setStartInfo(data);
      projectIdRef.current = data.projectId;
      setAuto(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动失败");
    } finally {
      setStarting(false);
    }
  }, [count, durationSec, resolution, generateAudio, userId]);

  const tick = useCallback(async () => {
    const projectId = projectIdRef.current;
    if (!projectId) return;
    setTicking(true);
    try {
      const r = await fetch(
        `/api/dev/canvas/i2v-load-test/tick?projectId=${encodeURIComponent(projectId)}`,
        { method: "POST" },
      );
      const data = (await r.json()) as Status;
      if (!r.ok || !data.ok) throw new Error(data.error ?? `tick_failed_${r.status}`);
      applyStatus(data);
      if (data.total > 0 && data.terminalCount === data.total) setAuto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "推进失败");
    } finally {
      setTicking(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    if (!auto) return;
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => window.clearInterval(id);
  }, [auto, tick]);

  // 综合 Q2/Q3 判定（结合跨轮询峰值）
  const blockingFinal = (() => {
    if (!status) return null;
    if (!status.trafficControlEnabled)
      return { verdict: "fail" as Verdict, detail: "未启用排队限流（TRAFFIC_CONTROL_OFF=1）" };
    if (oversubscribed)
      return {
        verdict: "fail" as Verdict,
        detail: `出现超额并发：峰值运行 ${peakRunning} > 上限 ${status.maxConcurrency}`,
      };
    const blocked = peakQueued > 0 || status.total > status.maxConcurrency;
    return {
      verdict: "pass" as Verdict,
      detail: `峰值运行 ${peakRunning} ≤ 上限 ${status.maxConcurrency}；峰值排队 ${peakQueued}（${blocked ? "确有阻塞排队" : "无需排队"}）`,
    };
  })();

  const releaseFinal = (() => {
    if (!status) return null;
    const allTerminal = status.total > 0 && status.terminalCount === status.total;
    if (!allTerminal) return status.verdicts?.release;
    if (status.runningVideoCount !== 0)
      return {
        verdict: "fail" as Verdict,
        detail: `全部终态但槽位未归零（${status.runningVideoCount}），疑似泄漏`,
      };
    return {
      verdict: "pass" as Verdict,
      detail: `峰值排队 ${peakQueued} 全部出队完成；槽位已归零`,
    };
  })();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/dev"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            返回 Dev
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold text-white sm:text-base">
              画布 · 图生视频并发压测（Seedance 2.0）
            </h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              上线前必测：正常运行 / 阻塞限流 / 阻塞释放 / 日志 4 时间正确
            </p>
          </div>
          <Link
            href="/dev/canvas/tasks"
            className="text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            任务总表
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6">
        {/* 配置区 */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
              并发条数
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
              时长（秒）
              <input
                type="number"
                min={4}
                max={15}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
              分辨率
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as "720p" | "1080p")}
                className="w-28 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={generateAudio}
                onChange={(e) => setGenerateAudio(e.target.checked)}
              />
              生成音频
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
              用户 ID（留空自动挑选）
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="auto"
                className="w-64 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => void start()}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-violet-400 disabled:opacity-60"
            >
              {starting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              开始压测
            </button>
          </div>
          <p className="mt-3 text-[11px] text-amber-300/80">
            ⚠️ 真实调用火山方舟，会产生实际算力费用。模型固定 Seedance 2.0，
            首帧使用火山官方 i2v 示例图。
          </p>
        </section>

        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {startInfo ? (
          <section className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] text-zinc-400 sm:grid-cols-3 lg:grid-cols-4">
            <Meta k="项目" v={`${startInfo.projectName}`} />
            <Meta k="projectId" v={startInfo.projectId} mono />
            <Meta k="测试用户" v={`${startInfo.userId}（${startInfo.userSource}）`} mono />
            <Meta k="凭证" v={startInfo.credentialAlias} />
            <Meta k="模型" v={startInfo.modelKey} />
            <Meta
              k="并发 / 时长"
              v={`${startInfo.count} 条 · ${startInfo.durationSec}s`}
            />
            <Meta
              k="限流"
              v={
                startInfo.trafficControlEnabled
                  ? `开启 · 并发上限 ${startInfo.maxConcurrency}`
                  : "关闭"
              }
            />
            <Meta k="scopeKey" v={startInfo.scopeKey} mono />
          </section>
        ) : null}

        {/* 实时状态条 */}
        {status ? (
          <section className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <Gauge
              running={status.runningVideoCount}
              max={status.maxConcurrency}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
              {Object.entries(STATUS_LABEL).map(([k, label]) =>
                status.counts[k] ? (
                  <span key={k} className={statusColor(k)}>
                    {label} {status.counts[k]}
                  </span>
                ) : null,
              )}
              <span className="text-zinc-500">
                峰值运行 {peakRunning} · 峰值排队 {peakQueued} · 令牌{" "}
                {status.dispatchTokens ?? "—"}
              </span>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setAuto((a) => !a)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            >
              {auto ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
              {auto ? "暂停自动推进" : "开始自动推进"}
            </button>
            <button
              type="button"
              onClick={() => void tick()}
              disabled={ticking}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${ticking ? "animate-spin" : ""}`} />
              手动推进一次
            </button>
          </section>
        ) : null}

        {/* 4 个判定卡 */}
        {status ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <VerdictCard title="正常运行" q="Q1" data={status.verdicts?.run} />
            <VerdictCard title="阻塞限流" q="Q2" data={blockingFinal ?? undefined} />
            <VerdictCard title="阻塞释放" q="Q3" data={releaseFinal ?? undefined} />
            <VerdictCard title="日志 4 时间" q="Q4" data={status.verdicts?.timing} />
          </section>
        ) : null}

        {/* 任务表 */}
        {status && status.tasks.length ? (
          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">节点</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-3 py-2.5 font-medium">总耗时</th>
                  <th className="px-3 py-2.5 font-medium">排队</th>
                  <th className="px-3 py-2.5 font-medium">厂商生成</th>
                  <th className="px-3 py-2.5 font-medium">后处理</th>
                  <th className="px-3 py-2.5 font-medium">Poll Δ</th>
                  <th className="px-3 py-2.5 font-medium">和校验</th>
                  <th className="px-3 py-2.5 font-medium">poll</th>
                  <th className="px-3 py-2.5 font-medium">厂商任务ID</th>
                  <th className="px-3 py-2.5 font-medium">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
                {status.tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">
                      {t.nodeId.replace("i2v-load-test-", "#")}
                    </td>
                    <td className={`px-3 py-2 ${statusColor(t.status)}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                      {t.failCode ? (
                        <p className="mt-0.5 text-[10px] text-red-300/70">
                          {t.failCode}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{ms(t.timing.durationMs)}</td>
                    <td className="px-3 py-2 tabular-nums text-amber-200/90">
                      {ms(t.timing.queueMs)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-emerald-200/90">
                      {ms(t.timing.generateMs)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-sky-200/90">
                      {ms(t.timing.vendorPostProcessMs)}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        t.timing.pollDelayOverLimit
                          ? "text-red-300"
                          : "text-violet-200/90"
                      }`}
                    >
                      {ms(t.timing.pollDelayMs)}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        t.timing.sumDeltaMs != null &&
                        Math.abs(t.timing.sumDeltaMs) > 2000
                          ? "text-red-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {t.timing.sumDeltaMs != null
                        ? `${t.timing.sumDeltaMs >= 0 ? "+" : ""}${ms(
                            t.timing.sumDeltaMs,
                          )}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">
                      {t.pollCount}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">
                      {t.kieTaskId ? t.kieTaskId.slice(0, 14) + "…" : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {t.ossUrl ? (
                        <a
                          href={t.ossUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-300 hover:underline"
                        >
                          视频
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-zinc-500">{k}</p>
      <p className={`mt-0.5 break-all text-zinc-200 ${mono ? "font-mono text-[10.5px]" : ""}`}>
        {v}
      </p>
    </div>
  );
}

function Gauge({ running, max }: { running: number; max: number }) {
  const over = running > max;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-500">信号灯</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.max(max, running) }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-2.5 rounded-sm ${
              i < running
                ? over
                  ? "bg-red-400"
                  : "bg-violet-400"
                : i < max
                  ? "bg-zinc-700"
                  : "bg-red-900"
            }`}
          />
        ))}
      </div>
      <span className={`text-xs tabular-nums ${over ? "text-red-300" : "text-zinc-300"}`}>
        {running}/{max}
      </span>
    </div>
  );
}
