"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DevHubBackgroundTask, DevHubService } from "@/lib/dev-hub-services";

type HealthEntry = {
  id: string;
  url: string;
  up: boolean;
  status: number | null;
  error: string | null;
};

type TaskHealthEntry =
  | {
      id: string;
      state: "running" | "stale";
      lastTickAt: string;
      iter: number;
      pid: number;
      ageMs: number;
      lastError?: string | null;
    }
  | { id: string; state: "missing" };

type Props = {
  services: DevHubService[];
  backgroundTasks: DevHubBackgroundTask[];
  initialHealth: HealthEntry[];
  initialTaskHealth: TaskHealthEntry[];
  checkedAt: string;
};

function StatusDot({
  up,
  size = "sm",
  title,
}: {
  up: boolean | null;
  size?: "sm" | "md";
  title?: string;
}) {
  const dim = size === "md" ? "size-3" : "size-2.5";
  if (up === null) {
    return (
      <span
        className={`inline-block ${dim} rounded-full bg-zinc-500 animate-pulse`}
        title={title ?? "检测中"}
      />
    );
  }
  return (
    <span
      className={`inline-block ${dim} rounded-full ${
        up ? "bg-emerald-400" : "bg-red-400"
      }`}
      title={title ?? (up ? "运行中" : "未响应")}
    />
  );
}

function TaskStatusDot({
  task,
  now,
}: {
  task: TaskHealthEntry | undefined;
  now: number | null;
}) {
  if (!task) return <StatusDot up={null} />;
  if (task.state === "running" || task.state === "stale") {
    const ageSec =
      now !== null
        ? Math.max(0, Math.round((now - new Date(task.lastTickAt).getTime()) / 1000))
        : Math.round(task.ageMs / 1000);
    if (task.state === "running")
      return <StatusDot up={true} title={`运行中 · 最近心跳 ${ageSec}s 前`} />;
    return <StatusDot up={false} title={`心跳已停 · ${ageSec}s 无更新`} />;
  }
  return (
    <span
      className="inline-block size-2.5 rounded-full bg-zinc-600"
      title="未运行 · 仓库根 pnpm dev:all 会带起"
    />
  );
}

function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return `${sec}s 前`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}min 前`;
  const hr = Math.round(min / 60);
  return `${hr}h 前`;
}

/** 仅在 client 端 mount 后启动 tick，避免与 SSR 输出失配。 */
function useClientNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function DevHubClient({
  services,
  backgroundTasks,
  initialHealth,
  initialTaskHealth,
  checkedAt: initialCheckedAt,
}: Props) {
  const [health, setHealth] = useState<Record<string, HealthEntry>>(() =>
    Object.fromEntries(initialHealth.map((h) => [h.id, h])),
  );
  const [taskHealth, setTaskHealth] = useState<Record<string, TaskHealthEntry>>(
    () => Object.fromEntries(initialTaskHealth.map((h) => [h.id, h])),
  );
  const [checkedAt, setCheckedAt] = useState(initialCheckedAt);
  const [refreshing, setRefreshing] = useState(false);
  const now = useClientNow(1000);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/dev/health", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as {
        checkedAt: string;
        services: HealthEntry[];
        backgroundTasks?: TaskHealthEntry[];
      };
      setHealth(Object.fromEntries(data.services.map((h) => [h.id, h])));
      if (data.backgroundTasks) {
        setTaskHealth(
          Object.fromEntries(data.backgroundTasks.map((h) => [h.id, h])),
        );
      }
      setCheckedAt(data.checkedAt);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const totalUp = Object.values(health).filter((h) => h.up).length;
  const totalRunning = Object.values(taskHealth).filter(
    (t) => t.state === "running",
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Development
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          本地开发导航
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          在仓库根目录执行{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
            pnpm dev:all
          </code>{" "}
          后，从下方进入各子站。该命令已默认包含 story:poll-loop 与 canvas:poll-loop。状态每 10 秒自动刷新。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span className="rounded bg-zinc-800/80 px-2 py-0.5">
            Web 服务 {totalUp}/{services.length} 在线
          </span>
          <span className="rounded bg-zinc-800/80 px-2 py-0.5">
            后台 poll-loop {totalRunning}/{backgroundTasks.length} 心跳
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dev/story/tasks"
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/20"
          >
            漫剧 KIE 任务看板 →
          </Link>
          <Link
            href="/dev/canvas/tasks"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            画布 KIE 任务看板 →
          </Link>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          上次检测：{new Date(checkedAt).toLocaleString("zh-CN")}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="ml-3 text-zinc-400 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
          >
            {refreshing ? "刷新中…" : "立即刷新"}
          </button>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Web 服务
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const h = health[s.id];
            const up = h ? h.up : null;
            return (
              <li
                key={s.id}
                className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 transition hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot up={up} />
                      <span className="font-medium text-white">{s.label}</span>
                      <span className="text-xs text-zinc-500">:{s.port}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                      {s.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a
                    href={
                      s.id === "story"
                        ? `${services.find((x) => x.id === "mall")?.url ?? ""}/story-open?path=${encodeURIComponent("/")}`
                        : s.id === "canvas"
                          ? `${services.find((x) => x.id === "mall")?.url ?? ""}/canvas-open?path=${encodeURIComponent("/projects")}`
                          : s.id === "prompt-optimizer"
                            ? `${services.find((x) => x.id === "mall")?.url ?? ""}/prompt-optimizer-open?path=${encodeURIComponent("/")}`
                            : s.url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200"
                  >
                    打开
                  </a>
                  <code className="truncate text-[10px] text-zinc-500">
                    {s.url}
                  </code>
                </div>
                {h && !h.up && h.error ? (
                  <p className="mt-2 text-[10px] text-red-300/90 line-clamp-2">
                    {h.error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          后台进程（poll-loop）
        </h2>
        <ul className="space-y-2">
          {backgroundTasks.map((t) => {
            const status = taskHealth[t.id];
            return (
              <li
                key={t.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <TaskStatusDot task={status} now={now} />
                  <p className="font-medium text-zinc-100">{t.label}</p>
                  {status?.state === "running" ? (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      运行中 · iter {status.iter}
                    </span>
                  ) : status?.state === "stale" ? (
                    <span
                      className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300"
                      suppressHydrationWarning
                    >
                      心跳停止 ·{" "}
                      {now !== null
                        ? Math.max(
                            0,
                            Math.round(
                              (now - new Date(status.lastTickAt).getTime()) / 1000,
                            ),
                          )
                        : Math.round(status.ageMs / 1000)}
                      s
                    </span>
                  ) : (
                    <span className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
                      未运行
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  {t.description}
                </p>
                {status && status.state !== "missing" ? (
                  <p className="mt-1 text-[10px] text-zinc-500" suppressHydrationWarning>
                    最后心跳{" "}
                    {now !== null
                      ? relativeTime(status.lastTickAt, now)
                      : new Date(status.lastTickAt).toLocaleTimeString("zh-CN")}{" "}
                    · pid {status.pid}
                    {status.lastError ? (
                      <span className="ml-2 text-red-300/80">
                        最近错误：{status.lastError}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <code className="mt-2 block text-[11px] text-zinc-500">
                  {t.command}
                </code>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="mt-10 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
        <p>
          本页仅在开发环境可用（<code>/dev</code>）。生产构建不会暴露。
        </p>
        <p className="mt-1">
          后台进程心跳：每 10s 由 poll-loop 写入 <code>os.tmpdir()</code>，60s 内有更新视为
          运行中；超过即标灰。
        </p>
      </footer>
    </div>
  );
}
