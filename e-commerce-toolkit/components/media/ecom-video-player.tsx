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

/**
 * 列表/卡片悬停预览：静音循环自动播放、无 controls，铺满封面之上。
 * 仅在悬停时挂载，避免整屏视频同时预载。
 */
export function EcomVideoHoverPreview({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    void v.play().catch(() => {
      /* 浏览器策略拦截 autoplay 时保持封面 */
    });
    return () => {
      v.pause();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full bg-black object-cover",
        className,
      )}
    />
  );
}

/** 列表/卡片缩略：静音、无 controls；点击后弹层须用 `EcomVideoPlayer` */
export function EcomVideoThumb({
  src,
  className,
  onClick,
  onLoadedData,
}: {
  src: string;
  className?: string;
  onClick?: () => void;
  onLoadedData?: () => void;
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
        onLoadedData={onLoadedData}
      />
    </Tag>
  );
}
