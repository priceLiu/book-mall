"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 首屏小窗：首帧/元数据懒加载，悬停播放、移开停止 */
export function SiteHomeHeroClip({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const srcAttachedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

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
    void v.play().catch(() => undefined);
  }, [attachSrc]);

  const onLeave = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
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
      {mounted ? (
        <video
          ref={videoRef}
          className="site-home-hero-clip-video"
          muted
          playsInline
          loop
          preload="none"
        />
      ) : null}
    </div>
  );
}
