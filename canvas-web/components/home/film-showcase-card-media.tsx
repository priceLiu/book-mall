"use client";

import { Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasBrandLoadingLogo } from "@/components/home/canvas-brand-loading-logo";
import { PROJECT_COVER_MEDIA_FILL_CLASS } from "@/components/canvas/project-cover-media";
import {
  prefersHoverVideoEnlarge,
  useHoverVideoEnlarge,
} from "@/components/home/hover-video-enlarge-preview";
import { makeVideoAudible, muteVideo } from "@/lib/canvas/hover-video-audio";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";
import { cn } from "@/lib/utils";

type Props = {
  url: string;
  alt: string;
  kind: "image" | "video";
  posterUrl?: string;
  placeholderLetter?: string;
  /** 弹层打开等场景：仅展示静态封面，禁用悬停播放 */
  calm?: boolean;
  /** 禁用居中放大预览（弹层内嵌封面等） */
  disableEnlargePreview?: boolean;
  /** 首屏网格等：跳过 IO 等待，直接加载媒体 */
  eager?: boolean;
};

function MediaPlaceholder({
  letter,
  hint,
}: {
  letter?: string;
  hint?: string;
}) {
  return (
    <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-cyan-400/10 to-[var(--canvas-surface-2)] text-[var(--canvas-muted)]">
      <span className="text-3xl font-light text-white/25">
        {letter?.slice(0, 1) || "影"}
      </span>
      {hint ? <span className="mt-1 text-[10px] text-white/30">{hint}</span> : null}
    </div>
  );
}

function inactiveHint(kind: "image" | "video", failed: boolean, hasUrl: boolean) {
  if (hasUrl && failed) return "媒体已失效";
  return kind === "video" ? "暂无成片" : "暂无预览";
}

/** 影视案例卡片媒体：视口内才加载；悬停格子内播放；点击右下角放大钮居中预览 */
export function FilmShowcaseCardMedia({
  url,
  alt,
  kind,
  posterUrl,
  placeholderLetter,
  calm = false,
  disableEnlargePreview = false,
  eager = false,
}: Props) {
  const [failed, setFailed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const enlarge = useHoverVideoEnlarge();
  const enlargeEnabled =
    !calm && !disableEnlargePreview && kind === "video" && Boolean(enlarge);

  const mediaUrl = url?.trim() ?? "";
  const poster = posterUrl?.trim();
  const showMedia = Boolean(mediaUrl) && !failed;
  // 悬停时立即激活媒体层，避免 IO 未触发时 videoRef 为空导致无法格内播放
  const { ref, active } = useLazyMediaActive<HTMLDivElement>(
    "360px",
    eager || hovering,
  );
  const isActive = eager || active || hovering;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!hovering || !isActive || kind !== "video" || calm || !showMedia) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setVideoReady(true);
    }
    makeVideoAudible(el);
    void el.play().catch(() => undefined);
  }, [hovering, isActive, kind, calm, showMedia]);

  const onEnter = useCallback(() => {
    setHovering(true);
    setVideoReady(false);
  }, []);

  const onLeave = useCallback(() => {
    setHovering(false);
    setVideoReady(false);
    const el = videoRef.current;
    if (!el) return;
    muteVideo(el);
    el.pause();
    el.currentTime = 0;
  }, []);

  const onOpenEnlarge = useCallback(
    (event: React.MouseEvent | React.PointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
      if (!enlargeEnabled) return;
      const el = videoRef.current;
      enlarge?.openPreview(
        { url: mediaUrl, posterUrl: poster || undefined, alt },
        el,
      );
    },
    [alt, enlarge, enlargeEnabled, mediaUrl, poster],
  );

  const onTouchToggle = useCallback(() => {
    if (!enlargeEnabled || prefersHoverVideoEnlarge()) return;
    enlarge?.toggleTouchPreview({
      url: mediaUrl,
      posterUrl: poster || undefined,
      alt,
    });
  }, [alt, enlarge, enlargeEnabled, mediaUrl, poster]);

  const onVideoReady = useCallback(() => setVideoReady(true), []);

  const onMediaError = useCallback(() => setFailed(true), []);

  const showHoverLoading =
    kind === "video" &&
    !calm &&
    hovering &&
    showMedia &&
    !videoReady &&
    !failed;

  const renderInactivePreview = () => {
    if (!showMedia) {
      return (
        <MediaPlaceholder
          letter={placeholderLetter}
          hint={inactiveHint(kind, failed, Boolean(mediaUrl))}
        />
      );
    }
    if (kind === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt={alt}
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onMediaError}
        />
      );
    }
    if (poster) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          aria-hidden
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onMediaError}
        />
      );
    }
    return (
      <video
        src={mediaUrl}
        className={PROJECT_COVER_MEDIA_FILL_CLASS}
        muted
        playsInline
        preload="metadata"
        onError={onMediaError}
      />
    );
  };

  return (
    <div
      ref={ref}
      className="relative size-full"
      onMouseEnter={
        kind === "video" && !calm && showMedia ? onEnter : undefined
      }
      onMouseLeave={
        kind === "video" && !calm && showMedia ? onLeave : undefined
      }
    >
      {!showMedia ? (
        <MediaPlaceholder
          letter={placeholderLetter}
          hint={inactiveHint(kind, failed, Boolean(mediaUrl))}
        />
      ) : !isActive ? (
        renderInactivePreview()
      ) : kind === "video" && calm && poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          aria-hidden
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onMediaError}
        />
      ) : kind === "video" ? (
        <>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              aria-hidden
              className={cn(
                PROJECT_COVER_MEDIA_FILL_CLASS,
                "pointer-events-none absolute inset-0 z-[1] transition-opacity duration-150",
                hovering ? "opacity-0" : "opacity-100",
              )}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={onMediaError}
            />
          ) : null}
          <video
            ref={videoRef}
            src={mediaUrl}
            poster={poster || undefined}
            className={cn(
              PROJECT_COVER_MEDIA_FILL_CLASS,
              poster && !hovering ? "opacity-0" : "opacity-100",
              "transition-opacity duration-150",
            )}
            muted
            playsInline
            loop
            preload={calm || hovering ? "metadata" : "none"}
            onClick={enlargeEnabled ? onTouchToggle : undefined}
            onLoadedData={onVideoReady}
            onCanPlay={onVideoReady}
            onError={onMediaError}
          />
          {showHoverLoading ? (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/35">
              <CanvasBrandLoadingLogo size="sm" />
            </div>
          ) : null}
          {enlargeEnabled && hovering ? (
            <button
              type="button"
              title="放大预览"
              aria-label="放大预览"
              className="pointer-events-auto absolute bottom-2 right-2 z-[6] inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-black/55 text-white/90 shadow-sm backdrop-blur-sm transition hover:border-white/35 hover:bg-black/70 hover:text-white"
              onPointerDown={onOpenEnlarge}
              onMouseDown={onOpenEnlarge}
              onClick={onOpenEnlarge}
            >
              <Maximize2 className="size-4 pointer-events-none" strokeWidth={2.25} />
            </button>
          ) : null}
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt={alt}
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onMediaError}
        />
      )}
    </div>
  );
}
