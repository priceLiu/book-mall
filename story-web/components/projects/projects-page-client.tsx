"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { apiListProjects, BookMallApiError } from "@/lib/projects/api";
import type { AspectRatio, ComicProjectListItem } from "@/lib/projects/types";

const GROUPS: { ratio: AspectRatio; label: string; gridClass: string }[] = [
  {
    ratio: "16:9",
    label: "横屏漫剧 · 16:9",
    gridClass: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  },
  {
    ratio: "9:16",
    label: "竖屏漫剧 · 9:16",
    gridClass:
      "grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  },
];

function ProjectGroup({
  label,
  projects,
  gridClass,
}: {
  label: string;
  projects: ComicProjectListItem[];
  gridClass: string;
}) {
  if (projects.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-white">{label}</h2>
        <span className="text-xs text-[var(--story-muted)]">
          {projects.length} 个项目
        </span>
      </div>
      <ul className={gridClass}>
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectsPageInner() {
  const base = useBookMallBaseUrl();
  const [projects, setProjects] = useState<ComicProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!base) return;
    setError(null);
    try {
      const list = await apiListProjects(base);
      setProjects(list);
    } catch (e) {
      const msg =
        e instanceof BookMallApiError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "加载失败";
      setError(msg);
      setProjects([]);
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grouped = useMemo(() => {
    const map: Record<AspectRatio, ComicProjectListItem[]> = {
      "16:9": [],
      "9:16": [],
    };
    for (const p of projects ?? []) {
      map[p.aspectRatio].push(p);
    }
    return map;
  }, [projects]);

  return (
    <div className="story-shell-page py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="twenty-eyebrow">Studio</p>
          <h1 className="story-serif mt-2 text-3xl text-white sm:text-4xl">
            创作室
          </h1>
          <p className="twenty-body mt-2 max-w-xl">
            管理你的 AI 漫剧项目：从故事设定到分镜生成，全流程在此开始。
          </p>
        </div>
        <Link href="/projects/new" className="twenty-btn shrink-0">
          <Plus className="mr-1.5 size-4" />
          新增项目
        </Link>
      </div>

      {projects === null ? (
        <div className="mt-10 flex items-center justify-center rounded-xl border border-dashed border-white/15 py-16 text-[var(--story-muted)]">
          <Loader2 className="mr-2 size-4 animate-spin" />
          加载项目列表…
        </div>
      ) : error ? (
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
      ) : projects.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-white/15 py-16 text-center">
          <p className="text-[var(--story-muted)]">
            还没有项目，点击「新增项目」开始创作。
          </p>
        </div>
      ) : (
        GROUPS.map(({ ratio, label, gridClass }) => (
          <ProjectGroup
            key={ratio}
            label={label}
            projects={grouped[ratio]}
            gridClass={gridClass}
          />
        ))
      )}
    </div>
  );
}

export function ProjectsPageClient() {
  return (
    <RequireAuth>
      <ProjectsPageInner />
    </RequireAuth>
  );
}
