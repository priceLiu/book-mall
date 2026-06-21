"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { QrCategory, QrTemplate } from "@/lib/qr-template-types";
import { QR_CATEGORIES } from "@/lib/qr-template-types";
import {
  QrGridGallerySkeleton,
  QrMasonryGallerySkeleton,
} from "@/components/quick-replica/qr-panel-skeletons";

function useMasonryColumnCount(): number {
  const [count, setCount] = useState(2);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setCount(5);
      else if (w >= 1024) setCount(4);
      else if (w >= 768) setCount(3);
      else setCount(2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

function distributeToColumns<T>(items: T[], columnCount: number): T[][] {
  const cols: T[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    cols[index % columnCount]?.push(item);
  });
  return cols;
}

const VIDEO_POSTER_SEEK_SEC = 0.01;

/** 预加载封面；失败时由组件切到 video 首帧 */
function useQrMasonryPoster(
  templateId: string,
  thumbnailUrl: string | undefined,
  videoUrl: string | null,
) {
  const [ready, setReady] = useState(false);
  const [posterMode, setPosterMode] = useState<"thumbnail" | "video-frame">(
    "thumbnail",
  );

  useEffect(() => {
    setReady(false);
    setPosterMode("thumbnail");

    if (!thumbnailUrl) {
      if (videoUrl) setPosterMode("video-frame");
      else setReady(true);
      return;
    }

    const img = new Image();
    img.decoding = "async";
    img.onload = () => setReady(true);
    img.onerror = () => {
      if (videoUrl) setPosterMode("video-frame");
      else setReady(true);
    };
    img.src = thumbnailUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [templateId, thumbnailUrl, videoUrl]);

  return { ready, setReady, posterMode, setPosterMode };
}

function MasonryTemplateCard({
  template,
  onSelect,
}: {
  template: QrTemplate;
  onSelect: () => void;
}) {
  const showTitle = template.title && !/^图像灵感 \d+$/.test(template.title);
  const previewVideoUrl =
    template.output?.mediaType === "video" ? template.output.url : null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ready, setReady, posterMode, setPosterMode } = useQrMasonryPoster(
    template.id,
    template.thumbnailUrl,
    previewVideoUrl,
  );
  const useVideoFramePoster = Boolean(
    previewVideoUrl && posterMode === "video-frame",
  );

  useEffect(() => {
    if (!useVideoFramePoster || !previewVideoUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const armSeek = () => {
      video.currentTime = VIDEO_POSTER_SEEK_SEC;
    };
    const onSeeked = () => setReady(true);
    const onError = () => setReady(true);

    video.addEventListener("loadeddata", armSeek);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadeddata", armSeek);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
  }, [useVideoFramePoster, previewVideoUrl, template.id, setReady]);

  const onHoverStart = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => undefined);
  };

  const onHoverEnd = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = useVideoFramePoster ? VIDEO_POSTER_SEEK_SEC : 0;
  };

  const showSkeleton = !ready;
  const showThumbImg = Boolean(
    template.thumbnailUrl && posterMode === "thumbnail",
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={previewVideoUrl ? onHoverStart : undefined}
      onMouseLeave={previewVideoUrl ? onHoverEnd : undefined}
      onFocus={previewVideoUrl ? onHoverStart : undefined}
      onBlur={previewVideoUrl ? onHoverEnd : undefined}
      className="qr-masonry-card group relative flex w-full flex-col gap-[6px] overflow-clip rounded-[16px] p-[6px] text-left transition-opacity duration-200 active:opacity-80"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-200 group-hover:opacity-0"
        style={{
          borderRadius: 16,
          background:
            "linear-gradient(0deg, rgba(214, 225, 255, 0.02), rgba(214, 225, 255, 0.02)), linear-gradient(135deg, rgba(211, 237, 248, 0.11) 0%, rgba(255, 255, 255, 0.1) 6.15%, rgba(255, 255, 255, 0) 20.09%), linear-gradient(315deg, rgba(211, 237, 248, 0.11) 0%, rgba(255, 255, 255, 0.1) 6.82%, rgba(255, 255, 255, 0) 18.46%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          borderRadius: 16,
          background:
            "linear-gradient(0deg, rgba(214, 225, 255, 0.02), rgba(214, 225, 255, 0.02)), linear-gradient(135deg, rgb(251, 35, 194) 0%, rgba(251, 35, 194, 0.3) 6.15%, rgba(251, 35, 194, 0) 20.09%), linear-gradient(315deg, rgb(251, 35, 194) 0%, rgba(251, 35, 194, 0.3) 6.82%, rgba(251, 35, 194, 0) 18.46%)",
        }}
      />
      <div
        className="pointer-events-none absolute bg-[#1a1a1a]"
        style={{ borderRadius: "calc(14.5px)", inset: "1.5px" }}
      />

      <div className="relative w-full overflow-hidden rounded-[10px] bg-zinc-900">
        {showSkeleton ? (
          <div className="qr-skeleton aspect-[4/3] w-full" aria-hidden />
        ) : null}
        {showThumbImg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={template.thumbnailUrl}
            alt={template.title}
            loading={previewVideoUrl ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={previewVideoUrl ? "high" : "auto"}
            onLoad={() => setReady(true)}
            onError={() => {
              if (previewVideoUrl) setPosterMode("video-frame");
              else setReady(true);
            }}
            className={`block h-auto w-full object-cover transition-all duration-300 group-hover:scale-[1.03]${previewVideoUrl ? " group-hover:opacity-0" : ""}${ready ? " opacity-100" : " opacity-0"}`}
          />
        ) : null}

        {previewVideoUrl ? (
          <video
            ref={videoRef}
            src={previewVideoUrl}
            poster={showThumbImg ? template.thumbnailUrl : undefined}
            loop
            muted
            playsInline
            preload="metadata"
            className={`pointer-events-none object-cover transition-opacity duration-150${
              useVideoFramePoster
                ? ready
                  ? " relative block h-auto w-full opacity-100 group-hover:scale-[1.03]"
                  : " absolute inset-0 h-full w-full opacity-0"
                : " absolute inset-0 h-full w-full opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          />
        ) : null}

        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(to top, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0) 34%), rgba(0, 0, 0, 0.42)",
          }}
        />

        <div className="pointer-events-none absolute inset-0 z-[2] flex items-end justify-center px-[6px] py-3">
          <span className="qr-masonry-recreate pointer-events-auto min-w-[72px] rounded-[8px] bg-[var(--qr-brand)] px-4 py-2 text-[12px] font-medium leading-4 tracking-[0.05px] text-white opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
            重现
          </span>
        </div>

        {(template.badges?.length ?? 0) > 0 || template.source === "user" ? (
          <div className="absolute left-2 top-2 z-[1] flex flex-wrap gap-1">
            {template.badges?.includes("pinned") ? (
              <span className="qr-badge-new">置顶</span>
            ) : null}
            {template.badges?.includes("new") ? (
              <span className="qr-badge-new">新</span>
            ) : null}
            {template.source === "user" ? (
              <span
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ background: "var(--qr-brand)", color: "#fff" }}
              >
                我的
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {showTitle ? (
        <div className="relative flex w-full flex-col items-start px-2 py-[6px]">
          <p className="w-full truncate text-[12px] font-medium leading-4 tracking-[0.05px] text-white">
            {template.title}
          </p>
        </div>
      ) : null}
    </button>
  );
}

function GridTemplateCard({
  template,
  onSelect,
}: {
  template: QrTemplate;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="qr-card group relative">
      <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={template.thumbnailUrl}
          alt={template.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      </div>
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {template.badges?.includes("pinned") ? (
          <span className="qr-badge-new">置顶</span>
        ) : null}
        {template.badges?.includes("new") ? (
          <span className="qr-badge-new">新</span>
        ) : null}
        {template.source === "user" ? (
          <span
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={{ background: "var(--qr-brand)", color: "#fff" }}
          >
            我的
          </span>
        ) : null}
      </div>
      <div className="px-2 py-2 text-sm font-medium">{template.title}</div>
    </button>
  );
}

type Props = {
  category: QrCategory | null;
  titleSuffix?: string;
  templates: QrTemplate[];
  loading: boolean;
  onSelectTemplate: (template: QrTemplate) => void;
};

export function QrTemplateGallery({
  category,
  titleSuffix,
  templates,
  loading,
  onSelectTemplate,
}: Props) {
  const columnCount = useMasonryColumnCount();
  const useMasonry =
    category === "image" ||
    category === "character" ||
    category === "world" ||
    category === "video";
  const columns = useMemo(
    () => (useMasonry ? distributeToColumns(templates, columnCount) : []),
    [templates, columnCount, useMasonry],
  );

  const categoryLabel = category
    ? QR_CATEGORIES.find((c) => c.id === category)?.label
    : null;

  const showSkeleton = loading && templates.length === 0;
  const showRefreshing = loading && templates.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header">
        <span>
          模板
          {categoryLabel ? ` · ${categoryLabel}` : ""}
          {titleSuffix ? ` · ${titleSuffix}` : ""}
        </span>
        {loading ? (
          <span className="qr-panel-muted animate-pulse">加载中…</span>
        ) : (
          <span className="qr-panel-muted">{templates.length} 项</span>
        )}
      </div>
      <div className="qr-scroll-panel min-h-0 flex-1 px-2 pb-3 md:px-1 md:pb-2">
        {showSkeleton ? (
          useMasonry ? (
            <QrMasonryGallerySkeleton columnCount={columnCount} />
          ) : (
            <QrGridGallerySkeleton />
          )
        ) : (
          <div
            className={
              showRefreshing ? "qr-panel-content-pending" : "qr-panel-content-ready"
            }
          >
            {useMasonry ? (
              <div className="flex gap-3">
                {columns.map((col, colIndex) => (
                  <div key={colIndex} className="flex min-w-0 flex-1 flex-col">
                    {col.map((t) => (
                      <div key={t.id} className="mb-3">
                        <MasonryTemplateCard
                          template={t}
                          onSelect={() => onSelectTemplate(t)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-2 md:grid-cols-3 xl:grid-cols-4">
                {templates.map((t) => (
                  <GridTemplateCard
                    key={t.id}
                    template={t}
                    onSelect={() => onSelectTemplate(t)}
                  />
                ))}
              </div>
            )}
            {!loading && templates.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">暂无模板</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
