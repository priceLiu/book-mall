"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, X } from "lucide-react";
import type { DiscoverVideoItem } from "@/lib/landing-showcase";

const INITIAL_BATCH = 12;
const LOAD_MORE_BATCH = 12;

type DiscoverMoreVideosProps = {
  videos: DiscoverVideoItem[];
};

function VideoCard({
  video,
  onOpen,
}: {
  video: DiscoverVideoItem;
  onOpen: (video: DiscoverVideoItem) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [srcReady, setSrcReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const attachSrc = useCallback(() => {
    if (srcReady) return;
    const el = videoRef.current;
    if (!el) return;
    el.src = video.playbackSrc;
    el.load();
    setSrcReady(true);
  }, [srcReady, video.playbackSrc]);

  const handleEnter = () => {
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
    <button
      type="button"
      className="group w-full text-left"
      onClick={() => onOpen(video)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <article className="overflow-hidden rounded-xl border border-white/10 bg-[var(--story-surface)] transition hover:border-white/20">
        <div ref={containerRef} className="relative aspect-video bg-black">
          {inView ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="none"
              poster={video.poster}
            />
          ) : video.poster ? (
            <Image
              src={video.poster}
              alt={video.title}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--story-muted)]">
              滚动到此处加载
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-100 transition group-hover:opacity-0">
            <span className="flex size-12 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur-sm">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </div>
        </div>
        <div className="border-t border-white/10 p-4">
          <h3 className="story-sans text-sm font-medium text-white sm:text-base">{video.title}</h3>
          <p className="mt-1 text-xs text-[var(--story-muted)] sm:text-sm">{video.author}</p>
        </div>
      </article>
    </button>
  );
}

function VideoModal({
  video,
  onClose,
}: {
  video: DiscoverVideoItem;
  onClose: () => void;
}) {
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      onClick={close}
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute -top-12 right-0 flex items-center gap-1 text-sm text-white/80 transition hover:text-white"
          onClick={close}
        >
          <X className="size-4" />
          关闭
        </button>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl">
          <video
            className="aspect-video max-h-[80vh] w-full bg-black object-contain"
            controls
            autoPlay
            playsInline
            preload="auto"
            poster={video.poster}
            src={video.playbackSrc}
          />
          <div className="border-t border-white/10 px-5 py-4">
            <h3 className="text-lg font-medium text-white">{video.title}</h3>
            <p className="mt-1 text-sm text-[var(--story-muted)]">{video.author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 发现更多：IntersectionObserver 懒挂载 + 悬停才拉流；首批分页，避免一次请求过多 mp4 */
export function DiscoverMoreVideos({ videos }: DiscoverMoreVideosProps) {
  const [active, setActive] = useState<DiscoverVideoItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);

  if (videos.length === 0) return null;

  const visible = videos.slice(0, visibleCount);
  const hasMore = visibleCount < videos.length;

  return (
    <>
      <section className="border-t border-white/10 py-16 sm:py-24">
        <div className="story-container">
          <p className="twenty-eyebrow">Discover More</p>
          <h2 className="story-serif mt-4 text-2xl text-white sm:text-3xl">发现更多</h2>
          <p className="twenty-body mt-3 max-w-2xl">
            社区创作者用 story-web 生成的横屏漫剧片段。悬停预览，点击全屏播放；视频按需异步加载。
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((video) => (
              <VideoCard key={video.id} video={video} onOpen={setActive} />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-10 text-center">
              <button
                type="button"
                className="twenty-btn-ghost"
                onClick={() =>
                  setVisibleCount((n) => Math.min(n + LOAD_MORE_BATCH, videos.length))
                }
              >
                加载更多（{visible.length}/{videos.length}）
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {active ? <VideoModal video={active} onClose={() => setActive(null)} /> : null}
    </>
  );
}
