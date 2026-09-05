"use client";

import { useRef } from "react";

/** 后台列表视频：悬停静音循环播放 */
export function AdminVideoHoverThumb({
  src,
  poster,
  className = "h-24 w-20",
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  if (!src) {
    return (
      <div
        className={`${className} rounded border border-dashed border-[#d0d7de] bg-[#f6f8fa]`}
      />
    );
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={poster || undefined}
      muted
      loop
      playsInline
      preload="metadata"
      className={`${className} rounded border border-[#d0d7de] bg-[#f6f8fa] object-cover`}
      onMouseEnter={() => {
        void ref.current?.play().catch(() => undefined);
      }}
      onMouseLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.pause();
        el.currentTime = 0;
      }}
    />
  );
}
