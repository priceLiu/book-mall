"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import {
  listMyCanvasProjects,
  type CanvasProjectSummary,
} from "@/lib/canvas-api";

const RECENT_LIMIT = 4;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/canvas/${p.id}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-3 transition hover:border-[var(--canvas-accent)]/35"
              >
                <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-white/10">
                  <CanvasListCover
                    url={p.thumbnailUrl}
                    name={p.name}
                    className="!aspect-square !rounded-lg !border-0"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{p.name}</p>
                  <p className="mt-1 text-xs text-[var(--canvas-muted)]">
                    {formatDate(p.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
