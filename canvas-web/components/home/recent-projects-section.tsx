"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  CanvasListCover,
  CANVAS_LIST_GRID_CLASS,
} from "@/components/canvas/canvas-list-cover";
import { CanvasListSkeleton } from "@/components/canvas/canvas-list-skeleton";
import {
  CanvasProjectOpenLink,
  CanvasProjectOpeningOverlay,
} from "@/components/canvas/canvas-project-open-link";
import { canvasListCoverPropsFromProject } from "@/lib/canvas/canvas-list-cover-props";
import { mergeProjectsListRefresh } from "@/lib/canvas/projects-list-merge";
import {
  consumeRecentProjectsStale,
  isRecentProjectsStale,
  subscribeRecentProjectsInvalidate,
} from "@/lib/canvas/recent-projects-invalidate";
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

/** 登录用户项目列表 · 不走门户静态快照，始终实时拉取 */
export function RecentProjectsSection() {
  const base = useBookMallBaseUrl();
  const [projects, setProjects] = useState<CanvasProjectSummary[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const prefetchProject = useCallback((_id: string) => {
    /* 详情预取已内置于 CanvasProjectOpenLink.pointerdown */
  }, []);

  const loadProjects = useCallback(async () => {
    if (!base?.trim()) {
      setProjects([]);
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }
    const hadData = projectsRef.current.length > 0;
    if (!hadData) setInitialLoading(true);
    else setRefreshing(true);
    try {
      const page = await listMyCanvasProjects(base, { limit: RECENT_LIMIT });
      const next = page.projects.slice(0, RECENT_LIMIT);
      setProjects((prev) => (hadData ? mergeProjectsListRefresh(prev, next) : next));
    } catch {
      if (!hadData) setProjects([]);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [base]);

  useEffect(() => {
    consumeRecentProjectsStale();
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => subscribeRecentProjectsInvalidate(() => void loadProjects()), [loadProjects]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!isRecentProjectsStale()) return;
      consumeRecentProjectsStale();
      void loadProjects();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadProjects]);

  if (!initialLoading && projects.length === 0) return null;

  return (
    <>
      <section className="canvas-page pb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">最近项目</h2>
            {refreshing ? (
              <Loader2 className="size-3.5 animate-spin text-[var(--canvas-muted)]" aria-hidden />
            ) : null}
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-0.5 text-sm text-[var(--canvas-muted)] transition hover:text-white"
          >
            查看全部
            <ChevronRight className="size-4" />
          </Link>
        </div>

        {initialLoading && projects.length === 0 ? (
          <CanvasListSkeleton sections={1} cardsPerSection={RECENT_LIMIT} />
        ) : (
          <ul className={CANVAS_LIST_GRID_CLASS}>
            {projects.map((p, index) => (
              <li
                key={p.id}
                className="group relative rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-4 transition hover:border-[var(--canvas-accent)]/40"
              >
                <CanvasProjectOpenLink
                  projectId={p.id}
                  openingProjectId={openingProjectId}
                  onOpeningProject={setOpeningProjectId}
                  onPrefetchProject={prefetchProject}
                >
                  <CanvasListCover
                    name={p.name}
                    calm={openingProjectId === p.id}
                    eager={index < RECENT_LIMIT}
                    {...canvasListCoverPropsFromProject(p)}
                  />
                  <p className="mt-3 truncate text-sm font-medium text-white">{p.name}</p>
                  <p className="mt-3 text-[11px] text-[var(--canvas-muted)]/80">
                    更新于 {formatDate(p.updatedAt)}
                  </p>
                </CanvasProjectOpenLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CanvasProjectOpeningOverlay visible={Boolean(openingProjectId)} />
    </>
  );
}
