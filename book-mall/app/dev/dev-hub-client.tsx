"use client";

import { useCallback, useEffect, useState } from "react";
import type { DevHubBackgroundTask, DevHubService } from "@/lib/dev-hub-services";

type HealthEntry = {
  id: string;
  url: string;
  up: boolean;
  status: number | null;
  error: string | null;
};

type Props = {
  services: DevHubService[];
  backgroundTasks: DevHubBackgroundTask[];
  initialHealth: HealthEntry[];
  checkedAt: string;
};

function StatusDot({ up }: { up: boolean | null }) {
  if (up === null) {
    return (
      <span
        className="inline-block size-2.5 rounded-full bg-zinc-500 animate-pulse"
        title="检测中"
      />
    );
  }
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${
        up ? "bg-emerald-400" : "bg-red-400"
      }`}
      title={up ? "运行中" : "未响应"}
    />
  );
}

export function DevHubClient({
  services,
  backgroundTasks,
  initialHealth,
  checkedAt: initialCheckedAt,
}: Props) {
  const [health, setHealth] = useState<Record<string, HealthEntry>>(() =>
    Object.fromEntries(initialHealth.map((h) => [h.id, h])),
  );
  const [checkedAt, setCheckedAt] = useState(initialCheckedAt);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/dev/health", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as {
        checkedAt: string;
        services: HealthEntry[];
      };
      setHealth(Object.fromEntries(data.services.map((h) => [h.id, h])));
      setCheckedAt(data.checkedAt);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

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
          或{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
            pnpm dev:all:story
          </code>
          后，从下方进入各子站。状态每 15 秒自动刷新。
        </p>
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
                    href={s.url}
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
          后台进程（无页面）
        </h2>
        <ul className="space-y-2">
          {backgroundTasks.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-3"
            >
              <p className="font-medium text-zinc-200">{t.label}</p>
              <p className="mt-1 text-xs text-zinc-400">{t.description}</p>
              <code className="mt-2 block text-[11px] text-zinc-500">
                {t.command}
              </code>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-10 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
        <p>
          本页仅在开发环境可用（<code>/dev</code>）。生产构建不会暴露。
        </p>
        <p className="mt-1">
          文档：仓库 <code>docs/dev.md</code>
        </p>
      </footer>
    </div>
  );
}
