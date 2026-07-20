"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { makeVideoAudible, muteVideo } from "@/lib/site-home/hover-audio";

/** 首屏小窗：封面立即可见，视频懒加载；悬停播放、移开停止 */
export function SiteHomeHeroClip({
  src,
  poster,
  eagerPoster = false,
}: {
  src: string;
  poster: string;
  eagerPoster?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const srcAttachedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const attachSrc = useCallback(() => {
    const v = videoRef.current;
    if (!v || srcAttachedRef.current) return;
    v.src = src;
    v.preload = "metadata";
    v.load();
    srcAttachedRef.current = true;
  }, [src]);

  useEffect(() => {
    if (!mounted) return;
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          attachSrc();
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [attachSrc, mounted]);

  const onEnter = useCallback(() => {
    attachSrc();
    const v = videoRef.current;
    if (!v) return;
    v.preload = "auto";
    makeVideoAudible(v);
  }, [attachSrc]);

  const onLeave = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    muteVideo(v);
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className="site-home-hero-clip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        aria-hidden
        className={`site-home-hero-clip-poster${videoReady ? " site-home-hero-clip-poster-hidden" : ""}`}
        loading={eagerPoster ? "eager" : "lazy"}
        fetchPriority={eagerPoster ? "high" : "auto"}
        decoding="async"
      />
      {mounted ? (
        <video
          ref={videoRef}
          className={`site-home-hero-clip-video${videoReady ? " site-home-hero-clip-video-ready" : ""}`}
          poster={poster}
          muted
          playsInline
          loop
          preload="none"
          onLoadedData={() => setVideoReady(true)}
        />
      ) : null}
    </div>
  );
}
