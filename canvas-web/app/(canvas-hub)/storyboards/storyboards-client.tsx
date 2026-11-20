"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";
import { GalleryMediaCard } from "@/components/gallery/gallery-media-card";
import {
  listCanvasWorks,
  type CanvasWorkRecord,
} from "@/lib/canvas-api";
import { STYLE_LIBRARY_GRID_CLASS } from "@/lib/canvas/style-library-card-chrome";

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
    <>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading && works.length === 0 ? (
        <CanvasListSkeleton sections={1} cardsPerSection={10} />
      ) : works.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--canvas-border)] p-12 text-center text-sm text-[var(--canvas-muted)]">
          还没有分镜产出。去
          <Link href="/projects" className="mx-1 text-[var(--canvas-accent)] hover:underline">
            我的画布
          </Link>
          运行分镜图或分镜视频节点。
        </div>
      ) : (
        <ul className={STYLE_LIBRARY_GRID_CLASS}>
          {works.map((w) => (
            <li key={w.id}>
              <GalleryMediaCard
                src={w.ossUrl}
                mediaKind={w.mediaKind}
                posterUrl={w.posterUrl}
                thumbnailUrl={w.thumbnailUrl}
                alt={w.project?.name ?? "分镜"}
                title={w.project?.name ?? "未命名项目"}
                subtitle={`${w.model} · ${w.completedAt ? new Date(w.completedAt).toLocaleString("zh-CN") : ""}`}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
