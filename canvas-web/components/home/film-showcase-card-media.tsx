"use client";

import { useCallback, useRef, useState } from "react";

import { PROJECT_COVER_MEDIA_FILL_CLASS } from "@/components/canvas/project-cover-media";
import {
  prefersHoverVideoEnlarge,
  useHoverVideoEnlarge,
} from "@/components/home/hover-video-enlarge-preview";
import { makeVideoAudible, muteVideo } from "@/lib/canvas/hover-video-audio";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";

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
};

function MediaPlaceholder({ letter, hint }: { letter?: string; hint?: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-cyan-400/10 to-[var(--canvas-surface-2)] text-[var(--canvas-muted)]">
      <span className="text-3xl font-light text-white/25">
        {letter?.slice(0, 1) || "影"}
      </span>
      {hint ? <span className="mt-1 text-[10px] text-white/30">{hint}</span> : null}
    </div>
  );
}

/** 影视案例卡片媒体：视口内才加载；悬停自动播放并出声；成片可居中放大预览 */
export function FilmShowcaseCardMedia({
  url,
  alt,
  kind,
  posterUrl,
  placeholderLetter,
  calm = false,
  disableEnlargePreview = false,
}: Props) {
  const { ref, active } = useLazyMediaActive<HTMLDivElement>("360px");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const enlarge = useHoverVideoEnlarge();
  const enlargeEnabled =
    !calm && !disableEnlargePreview && kind === "video" && Boolean(enlarge);

  const onEnter = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (enlargeEnabled) {
      el.muted = true;
      void el.play().catch(() => undefined);
      enlarge?.requestShow(
        { url, posterUrl: posterUrl?.trim() || undefined, alt },
        el,
      );
      return;
    }
    makeVideoAudible(el);
  }, [alt, enlarge, enlargeEnabled, posterUrl, url]);

  const onLeave = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (enlargeEnabled) {
      enlarge?.requestHide();
      return;
    }
    muteVideo(el);
    el.pause();
    el.currentTime = 0;
  }, [enlarge, enlargeEnabled]);

  const onTouchToggle = useCallback(() => {
    if (!enlargeEnabled || prefersHoverVideoEnlarge()) return;
    enlarge?.toggleTouchPreview({
      url,
      posterUrl: posterUrl?.trim() || undefined,
      alt,
    });
  }, [alt, enlarge, enlargeEnabled, posterUrl, url]);

  const poster = posterUrl?.trim();

  return (
    <div
      ref={ref}
      className="size-full"
      onPointerLeave={enlargeEnabled ? onLeave : undefined}
    >
      {!url?.trim() || failed ? (
        <MediaPlaceholder
          letter={placeholderLetter}
          hint={url && failed ? "媒体已失效" : "暂无预览"}
        />
      ) : !active ? (
        poster && kind === "video" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            aria-hidden
            className={PROJECT_COVER_MEDIA_FILL_CLASS}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <MediaPlaceholder letter={placeholderLetter} />
        )
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
        />
      ) : kind === "video" ? (
        <video
          ref={videoRef}
          src={url}
          poster={poster || undefined}
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          muted
          playsInline
          loop
          preload={calm ? "none" : "metadata"}
          onMouseEnter={calm ? undefined : onEnter}
          onMouseLeave={calm || enlargeEnabled ? undefined : onLeave}
          onFocus={calm ? undefined : onEnter}
          onBlur={calm ? undefined : onLeave}
          onClick={enlargeEnabled ? onTouchToggle : undefined}
          onError={() => setFailed(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
