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
  const [imageLoaded, setImageLoaded] = useState(false);
  const enlarge = useHoverVideoEnlarge();
  const enlargeEnabled =
    !calm && !disableEnlargePreview && kind === "video" && Boolean(enlarge);

  const mediaUrl = url?.trim() ?? "";
  const poster = posterUrl?.trim();
  const showMedia = Boolean(mediaUrl) && !failed;
  const { ref, active } = useLazyMediaActive<HTMLDivElement>(
    "360px",
    eager || hovering,
  );
  /** 视频层：仅延迟挂载 video；poster / 静态图不等待 IO */
  const shouldMountVideo =
    kind === "video" && showMedia && !calm && (eager || active || hovering);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setFailed(false);
    setImageLoaded(false);
    setVideoReady(false);
  }, [mediaUrl, poster, kind]);

  useEffect(() => {
    if (!hovering || !shouldMountVideo || kind !== "video" || !showMedia) return;
    const el = videoRef.current;
    if (!el) return;
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setVideoReady(true);
    }
    makeVideoAudible(el);
    void el.play().catch(() => undefined);
  }, [hovering, shouldMountVideo, kind, showMedia]);

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
    shouldMountVideo &&
    !videoReady &&
    !failed;

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
      <div className="relative size-full">
        {!imageLoaded ? (
          <MediaPlaceholder letter={placeholderLetter} hint="加载封面…" />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt={alt}
          className={cn(
            PROJECT_COVER_MEDIA_FILL_CLASS,
            "transition-opacity duration-200",
            imageLoaded ? "opacity-100" : "opacity-0",
          )}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageLoaded(true)}
          onError={onMediaError}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="relative size-full"
      onMouseEnter={!calm && showMedia ? onEnter : undefined}
      onMouseLeave={!calm && showMedia ? onLeave : undefined}
    >
      {poster ? (
        <>
          {!imageLoaded ? (
            <MediaPlaceholder letter={placeholderLetter} hint="加载封面…" />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            aria-hidden
            className={cn(
              PROJECT_COVER_MEDIA_FILL_CLASS,
              "pointer-events-none absolute inset-0 z-[1] transition-opacity duration-150",
              hovering && videoReady ? "opacity-0" : "opacity-100",
              !imageLoaded && "opacity-0",
            )}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            onError={onMediaError}
          />
        </>
      ) : shouldMountVideo ? null : (
        <video
          src={mediaUrl}
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          muted
          playsInline
          preload="metadata"
          onError={onMediaError}
        />
      )}

      {shouldMountVideo ? (
        <>
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
      ) : null}
    </div>
  );
}
