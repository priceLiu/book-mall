"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { GalleryMediaCard } from "@/components/gallery/gallery-media-card";
import {
  listCanvasCharacters,
  listCanvasWorks,
  type CanvasCharacterRecord,
  type CanvasWorkRecord,
} from "@/lib/canvas-api";

function Inner() {
  const base = useBookMallBaseUrl();
  const [characters, setCharacters] = useState<CanvasCharacterRecord[]>([]);
  const [works, setWorks] = useState<CanvasWorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const [charList, workList] = await Promise.all([
        listCanvasCharacters(base),
        listCanvasWorks(base),
      ]);
      setCharacters(charList);
      setWorks(workList);
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

  const empty = !loading && characters.length === 0 && works.length === 0;

  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <header className="mb-8">
        <p className="twenty-eyebrow">canvas-web · gallery</p>
        <h1 className="canvas-serif mt-2 text-3xl text-white">画作</h1>
        <p className="mt-2 text-sm text-[var(--canvas-muted)]">
          保存的三视图角色与全部生成结果。鼠标移上图卡可预览或下载。
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
      ) : empty ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有内容。先去
          <Link href="/projects" className="mx-1 text-[var(--canvas-accent)] hover:underline">
            我的画布
          </Link>
          运行三视图或生图节点试试。
        </div>
      ) : (
        <div className="space-y-10">
          {characters.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-medium text-white">人物三视图</h2>
              <p className="mb-4 text-[12px] text-[var(--canvas-muted)]">
                从三视图节点保存的角色，可在画布「我的角色」中快速插入图片节点。
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {characters.map((c) => (
                  <li key={c.id}>
                    <GalleryMediaCard
                      src={c.imageUrl}
                      alt={c.name}
                      title={c.name}
                      subtitle={
                        c.model
                          ? `${c.model} · ${new Date(c.updatedAt).toLocaleString("zh-CN")}`
                          : new Date(c.updatedAt).toLocaleString("zh-CN")
                      }
                      downloadName={`${c.name}.png`}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {works.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-medium text-white">全部画作</h2>
              <p className="mb-4 text-[12px] text-[var(--canvas-muted)]">
                所有画布运行成功的图像生成结果，按时间倒序展示。
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {works.map((w) => (
                  <li key={w.id}>
                    <GalleryMediaCard
                      src={w.ossUrl}
                      alt={w.project?.name ?? "画作"}
                      title={w.project?.name ?? "未命名"}
                      subtitle={
                        w.model +
                        " · " +
                        (w.completedAt
                          ? new Date(w.completedAt).toLocaleString("zh-CN")
                          : "—")
                      }
                      downloadName={`canvas-${w.id}.png`}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
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
