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
  fill = false,
  objectFit = "contain",
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
  poster?: string;
  /** 填满父容器（不强制 16:9），由外层节点决定可用高度 */
  fill?: boolean;
  objectFit?: "contain" | "cover";
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
        "relative max-w-full overflow-hidden bg-black/95",
        fill ? "h-full w-full" : "aspect-video w-full",
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
        className={cn(
          "h-full w-full",
          objectFit === "cover" ? "object-cover" : "object-contain",
        )}
      />
    </div>
  );
}
