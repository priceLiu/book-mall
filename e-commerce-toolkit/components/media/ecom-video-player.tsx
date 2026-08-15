"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 电商工具箱统一视频播放（对齐 canvas `CanvasVideoPlayer`：原生 controls + 黑底 + 可选 adaptiveBackdrop）。
 * 见 design/VIDEO.md
 */

const ADAPTIVE_MAX_H = "calc(100dvh - 88px)";
const ADAPTIVE_MAX_W = "min(96vw, 960px)";

function resolveAdaptiveBoxStyle(
  aspectRatio: number | null,
  fill: boolean,
): React.CSSProperties | undefined {
  if (fill || !aspectRatio) return undefined;
  if (aspectRatio >= 1) {
    return {
      aspectRatio: String(aspectRatio),
      width: ADAPTIVE_MAX_W,
      maxWidth: ADAPTIVE_MAX_W,
      maxHeight: ADAPTIVE_MAX_H,
    };
  }
  return {
    aspectRatio: String(aspectRatio),
    height: ADAPTIVE_MAX_H,
    maxHeight: ADAPTIVE_MAX_H,
    width: `min(${ADAPTIVE_MAX_W}, calc(${ADAPTIVE_MAX_H} * ${aspectRatio}))`,
    maxWidth: ADAPTIVE_MAX_W,
  };
}

function loadImageAspectRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      resolve(w > 0 && h > 0 ? w / h : null);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function EcomVideoPlayer({
  src,
  className,
  autoPlay = false,
  poster,
  fill = false,
  objectFit = "contain",
  adaptiveBackdrop = false,
  /** 弹层预览：无外圆角框，控件贴边自适应（与 Canvas 弹层一致） */
  frameless = false,
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
  poster?: string;
  fill?: boolean;
  objectFit?: "contain" | "cover";
  adaptiveBackdrop?: boolean;
  frameless?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const syncAspect = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.videoWidth <= 0 || v.videoHeight <= 0) return;
    setAspectRatio(v.videoWidth / v.videoHeight);
  }, []);

  useEffect(() => {
    setVideoReady(false);
    setAspectRatio(null);
  }, [src]);

  useEffect(() => {
    const posterUrl = poster?.trim();
    if (!posterUrl || fill || !adaptiveBackdrop) return;
    let cancelled = false;
    void loadImageAspectRatio(posterUrl).then((ratio) => {
      if (cancelled || ratio == null) return;
      setAspectRatio((prev) => prev ?? ratio);
    });
    return () => {
      cancelled = true;
    };
  }, [poster, fill, adaptiveBackdrop]);

  useEffect(() => {
    if (!autoPlay) return;
    const v = videoRef.current;
    if (!v) return;
    void v.play().catch(() => {
      /* 浏览器策略拦截 autoplay 时忽略 */
    });
  }, [autoPlay, src]);

  const posterUrl = poster?.trim() || undefined;
  const boxStyle = resolveAdaptiveBoxStyle(aspectRatio, fill);
  const hasAdaptiveAspect = !fill && adaptiveBackdrop && aspectRatio != null;

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        frameless ? "rounded-none" : "rounded-md",
        fill ? "h-full w-full" : "mx-auto w-auto max-w-full",
        !fill &&
          !hasAdaptiveAspect &&
          !adaptiveBackdrop &&
          "aspect-video w-full bg-black",
        !fill &&
          !hasAdaptiveAspect &&
          adaptiveBackdrop &&
          "aspect-video w-[min(96vw,960px)] max-h-[calc(100dvh-88px)]",
        className,
      )}
      style={boxStyle}
    >
      {adaptiveBackdrop ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl saturate-150"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-black to-zinc-900" />
          )}
          <div className="absolute inset-0 bg-black/45" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/95" aria-hidden />
      )}

      {!videoReady && adaptiveBackdrop ? (
        <div className="pointer-events-none absolute inset-0 z-[1] bg-black/25" aria-hidden />
      ) : null}

      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={posterUrl}
        controls
        playsInline
        preload="auto"
        className={cn(
          "relative z-10 h-full w-full bg-transparent",
          objectFit === "cover" ? "object-cover" : "object-contain",
        )}
        onLoadedMetadata={() => {
          syncAspect();
          setVideoReady(true);
        }}
        onLoadedData={() => setVideoReady(true)}
      />
    </div>
  );
}

/**
 * 列表/卡片悬停预览：静音循环自动播放、无 controls，铺满封面之上。
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

/** 列表/卡片缩略：静音、无 controls、object-cover fill；点击后弹层须用 `EcomVideoPlayer` */
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
        "relative block size-full overflow-hidden bg-black",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full object-cover"
        onLoadedData={onLoadedData}
      />
    </Tag>
  );
}
