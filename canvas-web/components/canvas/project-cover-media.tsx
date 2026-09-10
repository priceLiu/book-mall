"use client";

import { useEffect, useMemo, useState } from "react";
import { isProjectThumbnailVideoUrl } from "@/lib/canvas/project-thumbnail";
import { cn } from "@/lib/utils";

/** 列表 / 封面槽：铺满容器、居中裁剪，无留白边 */
export const PROJECT_COVER_MEDIA_FILL_CLASS =
  "block size-full object-cover object-center";

function CoverPlaceholder({
  placeholderLetter,
  hint,
}: {
  placeholderLetter?: string;
  hint?: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[var(--canvas-accent)]/10 to-[var(--canvas-surface-2)] text-[var(--canvas-muted)]">
      <span className="text-3xl font-light text-white/25">
        {placeholderLetter?.slice(0, 1) || "画"}
      </span>
      <span className="mt-1 text-[10px] text-white/30">{hint}</span>
    </div>
  );
}

function withCoverRetryToken(url: string, retry: number): string {
  if (retry <= 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_cover=${retry}`;
}

/** 画布列表 / 历史记录封面：支持图片与视频，加载失败时显示占位而非浏览器坏图图标 */
export function ProjectCoverMedia({
  url,
  alt,
  className = PROJECT_COVER_MEDIA_FILL_CLASS,
  placeholderLetter,
  eager = false,
}: {
  url?: string;
  alt: string;
  className?: string;
  /** 无封面或加载失败时显示的首字 */
  placeholderLetter?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setRetry(0);
  }, [url]);

  const mediaSrc = useMemo(
    () => (url?.trim() ? withCoverRetryToken(url.trim(), retry) : ""),
    [url, retry],
  );

  const onError = () => {
    if (retry < 1) {
      setRetry((n) => n + 1);
      setLoaded(false);
      return;
    }
    setFailed(true);
  };

  if (!mediaSrc || failed) {
    return (
      <CoverPlaceholder
        placeholderLetter={placeholderLetter}
        hint={mediaSrc && failed ? "封面已失效" : "等待出图"}
      />
    );
  }

  if (isProjectThumbnailVideoUrl(mediaSrc)) {
    return (
      <div className="relative size-full">
        {!loaded ? (
          <CoverPlaceholder placeholderLetter={placeholderLetter} hint="加载封面…" />
        ) : null}
        <video
          key={mediaSrc}
          src={mediaSrc}
          className={cn(className, !loaded && "opacity-0")}
          muted
          playsInline
          preload={eager ? "auto" : "metadata"}
          onLoadedData={() => setLoaded(true)}
          onCanPlay={() => setLoaded(true)}
          onError={onError}
        />
      </div>
    );
  }

  return (
    <div className="relative size-full">
      {!loaded ? (
        <CoverPlaceholder placeholderLetter={placeholderLetter} hint="加载封面…" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={mediaSrc}
        src={mediaSrc}
        alt={alt}
        className={cn(
          className,
          "transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
        )}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={onError}
      />
    </div>
  );
}
