"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useStorySession } from "@/components/auth/story-session-provider";
import {
  apiListDiscoverProjects,
  apiListProjects,
  BookMallApiError,
} from "@/lib/projects/api";
import type { AspectRatio, ComicProjectListItem } from "@/lib/projects/types";
import { storyLoginHref, storyRegisterHref } from "@/lib/portal-auth-links";

const DISCOVER_PAGE_SIZE = 18;

type AspectGroup = {
  ratio: AspectRatio;
  label: string;
  gridClass: string;
};

/** 我的项目 · 宽屏一行最多 4 个（响应式） */
const MY_PROJECT_GROUPS: AspectGroup[] = [
  {
    ratio: "16:9",
    label: "横屏漫剧 · 16:9",
    gridClass: "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  },
  {
    ratio: "9:16",
    label: "竖屏漫剧 · 9:16",
    gridClass:
      "grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4",
  },
];

/** 精品漫剧 · 宽屏一行最多 6 个（响应式） */
const DISCOVER_PROJECT_GROUPS: AspectGroup[] = [
  {
    ratio: "16:9",
    label: "横屏漫剧 · 16:9",
    gridClass:
      "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  },
  {
    ratio: "9:16",
    label: "竖屏漫剧 · 9:16",
    gridClass:
      "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  },
];

type IndexedProject = { project: ComicProjectListItem; listIndex: number };

function groupByAspect(projects: ComicProjectListItem[]): Record<AspectRatio, IndexedProject[]> {
  const map: Record<AspectRatio, IndexedProject[]> = {
    "16:9": [],
    "9:16": [],
  };
  projects.forEach((p, i) => {
    map[p.aspectRatio].push({ project: p, listIndex: i });
  });
  return map;
}

function ProjectGroup({
  label,
  items,
  gridClass,
  guestBrowse,
  previewOnHover,
  compact,
}: {
  label: string;
  items: IndexedProject[];
  gridClass: string;
  guestBrowse?: boolean;
  previewOnHover?: boolean;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className={compact ? "mt-6" : "mt-8"}>
      <div className="mb-3 flex items-baseline justify-between gap-3 sm:mb-4">
        <h3 className="text-sm font-medium text-white">{label}</h3>
        <span className="text-xs text-[var(--story-muted)]">
          {items.length} 个项目
        </span>
      </div>
      <ul className={gridClass}>
        {items.map(({ project, listIndex }) => (
          <li key={project.id}>
            <ProjectCard
              project={project}
              guestBrowse={guestBrowse}
              listIndex={listIndex}
              previewOnHover={previewOnHover}
              compact={compact}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectSection({
  title,
  description,
  projects,
  groups,
  guestBrowse,
  previewOnHover,
  compactCards,
  emptyHint,
}: {
  title: string;
  description?: string;
  projects: ComicProjectListItem[];
  groups: AspectGroup[];
  guestBrowse?: boolean;
  previewOnHover?: boolean;
  compactCards?: boolean;
  emptyHint?: React.ReactNode;
}) {
  const grouped = useMemo(() => groupByAspect(projects), [projects]);

  if (projects.length === 0 && emptyHint) {
    return (
      <section className="mt-12">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--story-muted)]">{description}</p>
          ) : null}
        </div>
        <div className="rounded-xl border border-dashed border-white/15 py-12 text-center text-sm text-[var(--story-muted)]">
          {emptyHint}
        </div>
      </section>
    );
  }

  if (projects.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--story-muted)]">{description}</p>
        ) : null}
      </div>
      {groups.map(({ ratio, label, gridClass }) => (
        <ProjectGroup
          key={ratio}
          label={label}
          items={grouped[ratio]}
          gridClass={gridClass}
          guestBrowse={guestBrowse}
          previewOnHover={previewOnHover}
          compact={compactCards}
        />
      ))}
    </section>
  );
}

export function ProjectsPageClient() {
  const base = useBookMallBaseUrl();
  const { loading: sessionLoading, active: sessionActiveFromCtx } = useStorySession();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const sessionActive = sessionLoading ? null : sessionActiveFromCtx;
  const [myProjects, setMyProjects] = useState<ComicProjectListItem[] | null>(null);
  const [discoverProjects, setDiscoverProjects] = useState<ComicProjectListItem[] | null>(
    null,
  );
  const [discoverTotal, setDiscoverTotal] = useState(0);
  const [discoverOffset, setDiscoverOffset] = useState(0);
  const [hasMoreDiscover, setHasMoreDiscover] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!base || sessionActive === null) return;
    setError(null);
    try {
      if (sessionActive) {
        const [mine, page] = await Promise.all([
          apiListProjects(base),
          apiListDiscoverProjects(base, { offset: 0, limit: DISCOVER_PAGE_SIZE }),
        ]);
        const myIds = new Set(mine.map((p) => p.id));
        const others = page.projects.filter((p) => !myIds.has(p.id));
        setMyProjects(mine.map((p) => ({ ...p, isMine: true })));
        setDiscoverProjects(others);
        setDiscoverTotal(page.total);
        setDiscoverOffset(page.nextOffset ?? page.projects.length);
        setHasMoreDiscover(page.hasMore);
      } else {
        const page = await apiListDiscoverProjects(base, {
          offset: 0,
          limit: DISCOVER_PAGE_SIZE,
        });
        setMyProjects([]);
        setDiscoverProjects(page.projects);
        setDiscoverTotal(page.total);
        setDiscoverOffset(page.nextOffset ?? page.projects.length);
        setHasMoreDiscover(page.hasMore);
      }
    } catch (e) {
      const msg =
        e instanceof BookMallApiError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "加载失败";
      setError(msg);
      setMyProjects([]);
      setDiscoverProjects([]);
      setHasMoreDiscover(false);
    }
  }, [base, sessionActive]);

  const loadMoreDiscover = useCallback(async () => {
    if (!base || !hasMoreDiscover || loadingMore || discoverProjects === null) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const page = await apiListDiscoverProjects(base, {
        offset: discoverOffset,
        limit: DISCOVER_PAGE_SIZE,
      });
      const myIds = new Set((myProjects ?? []).map((p) => p.id));
      setDiscoverProjects((prev) => {
        const seen = new Set(prev?.map((p) => p.id) ?? []);
        const merged = [...(prev ?? [])];
        for (const item of page.projects) {
          if (seen.has(item.id) || myIds.has(item.id)) continue;
          merged.push(item);
          seen.add(item.id);
        }
        return merged;
      });
      setDiscoverTotal(page.total);
      setDiscoverOffset(page.nextOffset ?? discoverOffset + page.projects.length);
      setHasMoreDiscover(page.hasMore);
    } catch (e) {
      const msg =
        e instanceof BookMallApiError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "加载更多失败";
      setError(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [base, discoverOffset, discoverProjects, hasMoreDiscover, loadingMore, myProjects]);

  useEffect(() => {
    if (sessionActive === null) return;
    setMyProjects(null);
    setDiscoverProjects(null);
    setDiscoverOffset(0);
    void refresh();
  }, [sessionActive, refresh]);

  useEffect(() => {
    if (!hasMoreDiscover) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMoreDiscover();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreDiscover, loadMoreDiscover, discoverProjects?.length]);

  const loading =
    sessionActive === null || myProjects === null || discoverProjects === null;
  const guestBrowse = sessionActive === false;
  const loggedIn = sessionActive === true;
  const hasAnyProject = (myProjects?.length ?? 0) + (discoverProjects?.length ?? 0) > 0;

  return (
    <div className="story-shell-page py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="twenty-eyebrow">Studio</p>
          <h1 className="story-serif mt-2 text-3xl text-white sm:text-4xl">
            创作室
          </h1>
          <p className="twenty-body mt-2 max-w-xl">
            {guestBrowse
              ? "浏览精品漫剧，悬停预览片段；登录后可创建与管理你的项目。"
              : "我的项目与精品漫剧分区展示；向下滚动可加载更多公开作品。"}
          </p>
        </div>
        {loggedIn ? (
          <Link href="/projects/new" className="twenty-btn shrink-0">
            <Plus className="mr-1.5 size-4" />
            新增项目
          </Link>
        ) : (
          <a
            href={storyLoginHref("/projects/new", base)}
            className="twenty-btn shrink-0"
          >
            <Plus className="mr-1.5 size-4" />
            登录后新建
          </a>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex items-center justify-center rounded-xl border border-dashed border-white/15 py-16 text-[var(--story-muted)]">
          <Loader2 className="mr-2 size-4 animate-spin" />
          加载项目列表…
        </div>
      ) : error && !hasAnyProject ? (
        <div className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-10 text-center">
          <p className="text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 rounded-md border border-white/20 px-4 py-1.5 text-sm text-white hover:bg-white/5"
          >
            重试
          </button>
        </div>
      ) : (
        <>
          {loggedIn ? (
            <ProjectSection
              title="我的项目"
              description="你创建与管理的漫剧项目"
              projects={myProjects ?? []}
              groups={MY_PROJECT_GROUPS}
              guestBrowse={false}
              previewOnHover={false}
              emptyHint={
                <>
                  <p>还没有自己的项目</p>
                  <Link href="/projects/new" className="twenty-btn mt-4 inline-flex">
                    <Plus className="mr-1.5 size-4" />
                    创建第一个项目
                  </Link>
                </>
              }
            />
          ) : null}

          <ProjectSection
            title="精品漫剧"
            description="社区公开作品，悬停预览片段"
            projects={discoverProjects ?? []}
            groups={DISCOVER_PROJECT_GROUPS}
            guestBrowse={guestBrowse}
            previewOnHover
            compactCards
            emptyHint={
              guestBrowse ? (
                <div className="space-y-4">
                  <p>暂无公开展示作品</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <a href={storyLoginHref("/", base)} className="twenty-btn">
                      登录
                    </a>
                    <a href={storyRegisterHref("/", base)} className="twenty-btn-ghost">
                      注册
                    </a>
                  </div>
                </div>
              ) : (
                "暂无精品漫剧"
              )
            }
          />

          {(discoverProjects?.length ?? 0) > 0 ? (
            <div ref={loadMoreRef} className="mt-10 flex flex-col items-center gap-2 py-6">
              {loadingMore ? (
                <span className="inline-flex items-center gap-2 text-sm text-[var(--story-muted)]">
                  <Loader2 className="size-4 animate-spin" />
                  加载更多作品…
                </span>
              ) : hasMoreDiscover ? (
                <span className="text-xs text-[var(--story-muted)]">
                  向下滚动加载更多（{discoverProjects?.length ?? 0}/{discoverTotal}）
                </span>
              ) : (
                <span className="text-xs text-[var(--story-muted)]">
                  已展示全部 {discoverTotal} 部精品漫剧
                </span>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
