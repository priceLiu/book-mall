"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { ProjectsSubNav } from "@/components/layout/projects-sub-nav";
import { GalleryMediaCard } from "@/components/gallery/gallery-media-card";
import {
  listCanvasWorks,
  type CanvasWorkRecord,
} from "@/lib/canvas-api";

function isStoryboardWork(w: CanvasWorkRecord): boolean {
  const m = w.model.toLowerCase();
  return (
    m.includes("video") ||
    m.includes("seedance") ||
    m.includes("kling") ||
    m.includes("wan") ||
    m.includes("frame") ||
    m.includes("image")
  );
}

export function StoryboardsClient() {
  const base = useBookMallBaseUrl();
  const [works, setWorks] = useState<CanvasWorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const all = await listCanvasWorks(base);
      setWorks(all.filter(isStoryboardWork));
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
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <div className="mb-6 flex justify-center">
        <ProjectsSubNav />
      </div>
      <header className="mb-8">
        <p className="twenty-eyebrow">canvas-web · storyboards</p>
        <h1 className="canvas-serif mt-2 flex items-center gap-2 text-3xl text-white">
          <Clapperboard className="size-8 text-[var(--canvas-accent)]" />
          分镜
        </h1>
        <p className="mt-2 text-sm text-[var(--canvas-muted)]">
          画布生成的分镜图与分镜视频。鼠标移上图卡可预览或下载。
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
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有分镜产出。去
          <Link href="/projects" className="mx-1 text-[var(--canvas-accent)] hover:underline">
            我的画布
          </Link>
          运行分镜图或分镜视频节点。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {works.map((w) => (
            <li key={w.id}>
              <GalleryMediaCard
                src={w.ossUrl}
                alt={w.project?.name ?? "分镜"}
                title={w.project?.name ?? "未命名项目"}
                subtitle={`${w.model} · ${w.completedAt ? new Date(w.completedAt).toLocaleString("zh-CN") : ""}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
