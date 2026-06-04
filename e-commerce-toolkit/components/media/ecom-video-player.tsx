"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * 电商工具箱统一视频播放（对齐 canvas `CanvasVideoPlayer`：原生 controls + 黑底）。
 * 见 design/VIDEO.md
 */
export function EcomVideoPlayer({
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
        "relative aspect-video w-full max-w-full overflow-hidden bg-black",
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

/** 列表/卡片缩略：静音、无 controls；点击后弹层须用 `EcomVideoPlayer` */
export function EcomVideoThumb({
  src,
  className,
  onClick,
}: {
  src: string;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "block size-full overflow-hidden bg-black",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    </Tag>
  );
}
