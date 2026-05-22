"use client";

import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComicProjectListItem } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚编辑";
  if (mins < 60) return `${mins} 分钟前编辑`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前编辑`;
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectCard({ project }: { project: ComicProjectListItem }) {
  const aspectClass =
    project.aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video";
  const cover = project.coverImageUrl || project.styleFallbackUrl;

  return (
    <Link
      href={`/project/${project.id}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-[var(--story-surface)] transition hover:border-white/20 hover:shadow-lg hover:shadow-black/30"
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-black/40",
          aspectClass,
        )}
      >
        {cover ? (
          <Image
            src={cover}
            alt={project.name}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--story-muted)]">
            <Loader2 className="mr-1.5 size-3 animate-spin" />
            封面生成中…
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
          {project.aspectRatio}
        </span>
        {project.status === "INITIALIZING" ? (
          <span className="absolute left-2 top-2 rounded-md bg-emerald-500/85 px-2 py-0.5 text-[10px] text-black backdrop-blur-sm">
            初始化中
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="truncate font-medium text-white">{project.name}</h3>
        <p className="mt-1 text-xs text-[var(--story-muted)]">
          {formatUpdatedAt(project.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
