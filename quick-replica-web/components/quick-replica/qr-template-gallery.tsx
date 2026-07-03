"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { QrCategory, QrTemplate } from "@/lib/qr-template-types";
import { QR_CATEGORIES, getKindDef } from "@/lib/qr-template-types";
import {
  isQrMasonryPosterCached,
  markQrMasonryPosterCached,
} from "@/lib/qr-masonry-poster-cache";
import {
  isAudioMediaUrl,
  isImageMediaUrl,
  isVideoMediaUrl,
} from "@/lib/qr-template-preview-media";
import { useIntersectionVisible } from "@/lib/use-intersection-visible";
import {
  QrGridGallerySkeleton,
  QrMasonryGallerySkeleton,
} from "@/components/quick-replica/qr-panel-skeletons";
import { HorizontalOscilloscopeWaveform } from "@/components/quick-replica/qr-audio-generate-preview";

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

function resolveGalleryThumbnailUrl(thumbnailUrl: string | undefined): string | undefined {
  const thumb = thumbnailUrl?.trim() ?? "";
  if (!thumb || isVideoMediaUrl(thumb)) return undefined;
  if (isImageMediaUrl(thumb)) return thumb;
  return thumb;
}

/** 预加载封面；失败时由组件在 hover 时切到 video 首帧 */
function useQrMasonryPoster(
  templateId: string,
  thumbnailUrl: string | undefined,
  videoUrl: string | null,
  enabled: boolean,
) {
  const [ready, setReady] = useState(() => isQrMasonryPosterCached(templateId));
  const [posterMode, setPosterMode] = useState<"thumbnail" | "video-frame">(
    "thumbnail",
  );

  useEffect(() => {
    if (!enabled) return;

    if (isQrMasonryPosterCached(templateId)) {
      setReady(true);
      return;
    }

    setReady(false);
    setPosterMode("thumbnail");

    const imageThumb = resolveGalleryThumbnailUrl(thumbnailUrl);
    if (!imageThumb) {
      if (videoUrl) setPosterMode("video-frame");
      else {
        markQrMasonryPosterCached(templateId);
        setReady(true);
      }
      return;
    }

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      markQrMasonryPosterCached(templateId);
      setReady(true);
    };
    img.onerror = () => {
      if (videoUrl) setPosterMode("video-frame");
      else {
        markQrMasonryPosterCached(templateId);
        setReady(true);
      }
    };
    img.src = imageThumb;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [templateId, thumbnailUrl, videoUrl, enabled]);

  return { ready, setReady, posterMode, setPosterMode };
}

function MasonryTemplateCard({
  template,
  onSelect,
}: {
  template: QrTemplate;
  onSelect: () => void;
}) {
  const { ref: visibilityRef, visible } = useIntersectionVisible();
  const [hovering, setHovering] = useState(false);
  const showTitle = template.title && !/^图像灵感 \d+$/.test(template.title);
  const previewVideoUrl =
    template.output?.mediaType === "video" ? template.output.url : null;
  const imageThumbUrl = resolveGalleryThumbnailUrl(template.thumbnailUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ready, setReady, posterMode, setPosterMode } = useQrMasonryPoster(
    template.id,
    template.thumbnailUrl,
    previewVideoUrl,
    visible,
  );
  const useVideoFramePoster = Boolean(
    previewVideoUrl && posterMode === "video-frame" && visible,
  );
  const mountVideo =
    Boolean(previewVideoUrl) &&
    visible &&
    (hovering || useVideoFramePoster);

  useEffect(() => {
    if (!mountVideo || !useVideoFramePoster || !previewVideoUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const armSeek = () => {
      video.currentTime = VIDEO_POSTER_SEEK_SEC;
    };
    const onSeeked = () => {
      markQrMasonryPosterCached(template.id);
      setReady(true);
    };
    const onError = () => {
      markQrMasonryPosterCached(template.id);
      setReady(true);
    };

    video.addEventListener("loadeddata", armSeek);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadeddata", armSeek);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
  }, [mountVideo, useVideoFramePoster, previewVideoUrl, template.id, setReady]);

  const onHoverStart = () => {
    setHovering(true);
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => undefined);
  };

  const onHoverEnd = () => {
    setHovering(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = useVideoFramePoster ? VIDEO_POSTER_SEEK_SEC : 0;
  };

  const showSkeleton = visible && !ready;
  const showThumbImg = Boolean(imageThumbUrl && posterMode === "thumbnail" && visible);

  return (
    <button
      type="button"
      ref={visibilityRef}
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
            src={imageThumbUrl}
            alt={template.title}
            loading="lazy"
            decoding="async"
            onLoad={() => {
              markQrMasonryPosterCached(template.id);
              setReady(true);
            }}
            onError={() => {
              if (previewVideoUrl) setPosterMode("video-frame");
              else {
                markQrMasonryPosterCached(template.id);
                setReady(true);
              }
            }}
            className={`block h-auto w-full object-cover transition-all duration-300 group-hover:scale-[1.03]${previewVideoUrl ? " group-hover:opacity-0" : ""}${ready ? " opacity-100" : " opacity-0"}`}
          />
        ) : null}

        {mountVideo ? (
          <video
            ref={videoRef}
            src={previewVideoUrl ?? undefined}
            poster={imageThumbUrl}
            loop
            muted
            playsInline
            preload={useVideoFramePoster ? "metadata" : "none"}
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

function isAudioTemplate(template: QrTemplate): boolean {
  return (
    template.category === "audio" ||
    template.output?.mediaType === "audio" ||
    template.reference.model.role === "AUDIO" ||
    Boolean(template.output?.url && isAudioMediaUrl(template.output.url))
  );
}

function resolveAudioCardMeta(template: QrTemplate) {
  const params = template.reference.model.params;
  const voiceLabel =
    typeof params.voice_label === "string"
      ? params.voice_label
      : typeof params.voice_id === "string"
        ? params.voice_id
        : "音色";
  const voiceLetter =
    typeof voiceLabel === "string" && voiceLabel.length
      ? voiceLabel.slice(0, 1)
      : "♪";
  const kindLabel = getKindDef(template.kind)?.label ?? template.kind;
  const audioUrl = template.output?.url?.trim() ?? "";
  return { voiceLabel, voiceLetter, kindLabel, audioUrl };
}

function AudioTemplateCard({
  template,
  onSelect,
}: {
  template: QrTemplate;
  onSelect: () => void;
}) {
  const { ref, visible } = useIntersectionVisible();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { voiceLabel, voiceLetter, kindLabel, audioUrl } = resolveAudioCardMeta(template);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  return (
    <button
      type="button"
      ref={ref}
      onClick={onSelect}
      className="qr-card group relative overflow-hidden text-left"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#0a0f18] via-[#0d1117] to-[#0a1210]">
        <div className="pointer-events-none absolute inset-x-2 inset-y-3">
          <HorizontalOscilloscopeWaveform active={playing} barCount={56} className="h-full opacity-90" />
        </div>
        <div className="relative flex h-full items-center gap-3 px-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500 text-lg font-semibold text-white">
            {voiceLetter}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{voiceLabel}</p>
            <p className="truncate text-[11px] text-white/55">{kindLabel}</p>
          </div>
          {audioUrl && visible ? (
            <span
              role="button"
              tabIndex={0}
              onClick={togglePlay}
              onKeyDown={(e) => {
                if (e.key === "Enter") togglePlay(e as unknown as React.MouseEvent);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/40 text-xs text-white hover:bg-black/55"
            >
              {playing ? "❚❚" : "▶"}
            </span>
          ) : null}
        </div>
        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="none"
            className="hidden"
            onEnded={() => setPlaying(false)}
          />
        ) : null}
      </div>
      <div className="absolute left-2 top-2">
        <span className="rounded-full bg-[rgba(59,130,246,0.35)] px-2 py-0.5 text-[10px] text-white">
          {kindLabel}
        </span>
      </div>
      <div className="px-2 py-2 text-sm font-medium">{template.title}</div>
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
  const { ref, visible } = useIntersectionVisible();
  const imageThumbUrl = resolveGalleryThumbnailUrl(template.thumbnailUrl);

  return (
    <button
      type="button"
      ref={ref}
      onClick={onSelect}
      className="qr-card group relative"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
        {!visible || !imageThumbUrl ? (
          <div className="qr-skeleton h-full w-full" aria-hidden />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageThumbUrl}
            alt={template.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        )}
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
  const useAudioCards = category === "audio";
  const columns = useMemo(
    () => (useMasonry ? distributeToColumns(templates, columnCount) : []),
    [templates, columnCount, useMasonry],
  );

  const categoryLabel = category
    ? QR_CATEGORIES.find((c) => c.id === category)?.label
    : null;
  const headerLabel =
    categoryLabel === "声音" || category === "audio" ? "作品" : "模板";

  const showSkeleton = loading && templates.length === 0;
  const showRefreshing = loading && templates.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header">
        <span>
          {headerLabel}
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
              <div className="grid grid-cols-1 gap-3 p-2 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map((t) =>
                  useAudioCards || isAudioTemplate(t) ? (
                    <AudioTemplateCard
                      key={t.id}
                      template={t}
                      onSelect={() => onSelectTemplate(t)}
                    />
                  ) : (
                    <GridTemplateCard
                      key={t.id}
                      template={t}
                      onSelect={() => onSelectTemplate(t)}
                    />
                  ),
                )}
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
