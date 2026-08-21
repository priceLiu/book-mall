"use client";

import { useCallback, useRef, useState } from "react";

import { PROJECT_COVER_MEDIA_FILL_CLASS } from "@/components/canvas/project-cover-media";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";

type Props = {
  url: string;
  alt: string;
  kind: "image" | "video";
  posterUrl?: string;
  placeholderLetter?: string;
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

/** 影视案例卡片媒体：视口内才加载；视频悬停自动播放 */
export function FilmShowcaseCardMedia({
  url,
  alt,
  kind,
  posterUrl,
  placeholderLetter,
}: Props) {
  const { ref, active } = useLazyMediaActive<HTMLDivElement>("360px");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  const onEnter = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => {
      /* 浏览器策略或加载中，忽略 */
    });
  }, []);

  const onLeave = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, []);

  const poster = posterUrl?.trim();

  return (
    <div ref={ref} className="size-full">
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
      ) : kind === "video" ? (
        <video
          ref={videoRef}
          src={url}
          poster={poster || undefined}
          className={PROJECT_COVER_MEDIA_FILL_CLASS}
          muted
          playsInline
          loop
          preload="metadata"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
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
