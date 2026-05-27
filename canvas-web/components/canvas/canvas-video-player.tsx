"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Canvas 统一视频播放（与 tool-web 图生视频实验室一致：原生 controls + 黑底容器）。
 * 见 canvas-web/docs/design.md §12
 */
export function CanvasVideoPlayer({
  src,
  className,
  autoPlay = false,
  poster,
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!autoPlay) return;
    const v = videoRef.current;
    if (!v) return;
    void v.play().catch(() => {
      /* 浏览器策略拦截 autoplay 时忽略 */
    });
  }, [autoPlay, src]);

  return (
    <div
      className={cn(
        "relative aspect-video w-full max-w-full overflow-hidden bg-black/95",
        className,
      )}
    >
      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
