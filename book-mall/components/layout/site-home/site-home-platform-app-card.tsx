"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";

import { makeVideoAudible, muteVideo } from "@/lib/site-home/hover-audio";
import type { SiteHomePlatformApp } from "@/lib/site-home/platform-apps";
import { cn } from "@/lib/utils";

function AppCoverMedia({
  posterUrl,
  videoUrl,
  title,
}: {
  posterUrl: string;
  videoUrl: string | null;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onHoverStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    makeVideoAudible(video);
  }, []);

  const onHoverEnd = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    muteVideo(video);
    video.pause();
    video.currentTime = 0;
  }, []);

  return (
    <div
      className="site-home-platform-app-card__media relative aspect-[16/10] w-full overflow-hidden bg-muted"
      onMouseEnter={videoUrl ? onHoverStart : undefined}
      onMouseLeave={videoUrl ? onHoverEnd : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterUrl}
        alt=""
        className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.04]"
      />
      {videoUrl && mounted ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          muted
          playsInline
          loop
          preload="metadata"
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      ) : null}
      {videoUrl ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-0"
          aria-hidden
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <Play className="size-5 fill-white text-white" />
          </span>
        </span>
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-3 pt-10"
        aria-hidden
      >
        <p className="text-base font-semibold tracking-tight text-white sm:text-lg">{title}</p>
      </div>
    </div>
  );
}

export function SiteHomePlatformAppCard({ app }: { app: SiteHomePlatformApp }) {
  return (
    <a
      href={app.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "site-home-platform-app-card group flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
        "transition duration-300 hover:border-foreground/15 hover:shadow-lg",
      )}
    >
      <AppCoverMedia posterUrl={app.posterUrl} videoUrl={app.videoUrl} title={app.label} />
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-4">
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{app.tagline}</p>
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-foreground">
          进入应用
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </a>
  );
}
