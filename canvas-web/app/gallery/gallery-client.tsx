"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { listCanvasWorks, type CanvasWorkRecord } from "@/lib/canvas-api";

function Inner() {
  const base = useBookMallBaseUrl();
  const [works, setWorks] = useState<CanvasWorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const list = await listCanvasWorks(base);
      setWorks(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="canvas-container py-10">
      <header className="mb-6">
        <p className="twenty-eyebrow">canvas-web · gallery</p>
        <h1 className="canvas-serif mt-2 text-3xl text-white">画作</h1>
        <p className="mt-2 text-sm text-[var(--canvas-muted)]">
          所有画布运行成功的图像生成结果，按时间倒序展示。点图查看大图。
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : works.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有画作。先去
          <Link href="/projects" className="mx-1 text-[var(--canvas-accent)] hover:underline">
            我的画布
          </Link>
          运行一个生成节点试试。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {works.map((w) => (
            <li
              key={w.id}
              className="group rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-2 transition hover:border-[var(--canvas-accent)]/40"
            >
              <a href={w.ossUrl} target="_blank" rel="noopener noreferrer" className="block">
                <div className="aspect-square overflow-hidden rounded-lg bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={w.ossUrl}
                    alt={w.project?.name ?? "画作"}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="px-1 pb-1 pt-2">
                  <p className="truncate text-xs text-white">
                    {w.project?.name ?? "未命名"}
                  </p>
                  <p className="truncate text-[10px] text-[var(--canvas-muted)]">
                    {w.model} ·{" "}
                    {w.completedAt
                      ? new Date(w.completedAt).toLocaleString("zh-CN")
                      : "—"}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GalleryClient() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
