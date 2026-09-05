"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { resolveDiscoverPreviewVideoUrl } from "@/lib/discover-preview-videos";
import { storyLoginHref } from "@/lib/portal-auth-links";
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

export function ProjectCard({
  project,
  guestBrowse = false,
  listIndex = 0,
  previewOnHover,
  compact = false,
}: {
  project: ComicProjectListItem;
  /** 未登录浏览：点击卡片引导主站登录 / 静默换票 */
  guestBrowse?: boolean;
  /** 列表序号，用于映射预览视频 */
  listIndex?: number;
  /** 悬停播放预览；默认与 guestBrowse 一致 */
  previewOnHover?: boolean;
  /** 精品漫剧等高密度网格：缩小内边距与字号 */
  compact?: boolean;
}) {
  const bookOrigin = useBookMallBaseUrl();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [srcReady, setSrcReady] = useState(false);
  const hoverPreview = previewOnHover ?? guestBrowse;

  const aspectClass =
    project.aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video";
  const cover = project.coverImageUrl || project.styleFallbackUrl;
  const previewSrc =
    project.previewVideoUrl ?? resolveDiscoverPreviewVideoUrl(listIndex);
  const href = guestBrowse
    ? storyLoginHref(`/project/${project.id}`, bookOrigin)
    : `/project/${project.id}`;

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !hoverPreview) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hoverPreview]);

  const attachSrc = useCallback(() => {
    if (srcReady || !hoverPreview) return;
    const el = videoRef.current;
    if (!el) return;
    el.src = previewSrc;
    el.load();
    setSrcReady(true);
  }, [hoverPreview, previewSrc, srcReady]);

  const handleEnter = () => {
    if (!hoverPreview) return;
    attachSrc();
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };

  const handleLeave = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  };

  return (
    <Link
      href={href}
      className={cn(
        "group block overflow-hidden rounded-xl border border-white/10 bg-[var(--story-surface)] transition hover:border-white/20 hover:shadow-lg hover:shadow-black/30",
        compact && "rounded-lg",
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative w-full overflow-hidden bg-black/40",
          aspectClass,
        )}
      >
        {hoverPreview && inView ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
            muted
            loop
            playsInline
            preload="none"
            poster={cover || undefined}
          />
        ) : null}
        {cover ? (
          <Image
            src={cover}
            alt={project.name}
            fill
            sizes={
              compact
                ? "(max-width: 640px) 50vw, (max-width: 1280px) 20vw, 16vw"
                : "(max-width: 768px) 100vw, 320px"
            }
            className={cn(
              "object-cover transition duration-500 group-hover:scale-[1.02]",
              hoverPreview && "group-hover:opacity-0 group-focus-visible:opacity-0",
            )}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--story-muted)]">
            <Loader2 className="mr-1.5 size-3 animate-spin" />
            封面生成中…
          </div>
        )}
        {hoverPreview ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 transition group-hover:opacity-0 group-focus-visible:opacity-0">
            <span
              className={cn(
                "flex items-center justify-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur-sm",
                compact ? "size-8" : "size-10",
              )}
            >
              <Play
                className={cn("fill-current", compact ? "ml-0.5 size-3" : "ml-0.5 size-4")}
              />
            </span>
          </div>
        ) : null}
        <span
          className={cn(
            "absolute right-2 top-2 rounded-md bg-black/60 text-white backdrop-blur-sm",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
          )}
        >
          {project.aspectRatio}
        </span>
        {project.status === "INITIALIZING" ? (
          <span className="absolute left-2 top-2 rounded-md bg-emerald-500/85 px-2 py-0.5 text-[10px] text-black backdrop-blur-sm">
            初始化中
          </span>
        ) : null}
      </div>
      <div className={cn(compact ? "p-2.5 sm:p-3" : "p-4")}>
        <h3
          className={cn(
            "truncate font-medium text-white",
            compact ? "text-xs sm:text-sm" : "text-base",
          )}
        >
          {project.name}
        </h3>
        <p
          className={cn(
            "mt-1 text-[var(--story-muted)]",
            compact ? "text-[10px] sm:text-xs" : "text-xs",
          )}
        >
          {formatUpdatedAt(project.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
