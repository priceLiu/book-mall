"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  CanvasListCover,
  CANVAS_LIST_GRID_CLASS,
} from "@/components/canvas/canvas-list-cover";
import { canvasListCoverPropsFromProject } from "@/lib/canvas/canvas-list-cover-props";
import {
  listMyCanvasProjects,
  type CanvasProjectSummary,
} from "@/lib/canvas-api";

const RECENT_LIMIT = 5;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN");
}

export function RecentProjectsSection() {
  const base = useBookMallBaseUrl();
  const [projects, setProjects] = useState<CanvasProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!base?.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void listMyCanvasProjects(base)
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setProjects(sorted.slice(0, RECENT_LIMIT));
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [base]);

  if (!loading && projects.length === 0) return null;

  return (
    <section className="canvas-page pb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">最近项目</h2>
        <Link
          href="/projects"
          className="inline-flex items-center gap-0.5 text-sm text-[var(--canvas-muted)] transition hover:text-white"
        >
          查看全部
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载最近项目…
        </div>
      ) : (
        <ul className={CANVAS_LIST_GRID_CLASS}>
          {projects.map((p) => (
            <li
              key={p.id}
              className="group relative rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-4 transition hover:border-[var(--canvas-accent)]/40"
            >
              <Link href={`/canvas/${p.id}`} className="block" prefetch>
                <CanvasListCover name={p.name} {...canvasListCoverPropsFromProject(p)} />
                <p className="mt-3 truncate text-sm font-medium text-white">{p.name}</p>
                <p className="mt-3 text-[11px] text-[var(--canvas-muted)]/80">
                  更新于 {formatDate(p.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
